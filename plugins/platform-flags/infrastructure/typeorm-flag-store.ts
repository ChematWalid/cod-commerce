import type { FlagSeed } from '@cod/shared';
import { SNOWFLAKE_ID_GENERATOR } from '@cod/plugin-tenancy';
import { Inject, Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { EntityManager } from 'typeorm';
import type { FlagChange, FlagPatch, FlagStorePort, OverrideKey } from '../domain/ports/flag-store.port';
import type { FlagSnapshot, FlagState } from '../domain/snapshot';
import { FeatureFlagEntity } from './feature-flag.entity';
import { FeatureFlagOverrideEntity } from './feature-flag-override.entity';

interface IdSource {
  next(): string;
}

const stateOf = (flag: FeatureFlagEntity, overrides: readonly FeatureFlagOverrideEntity[]): FlagState => ({
  description: flag.description,
  defaultEnabled: flag.defaultEnabled,
  rolloutPercent: flag.rolloutPercent,
  updatedAt: flag.updatedAt.toISOString(),
  overrides: overrides
    .map((override) => ({ scope: override.scope, scopeId: override.scopeId, enabled: override.enabled }))
    .sort((left, right) =>
      `${left.scope}:${left.scopeId}`.localeCompare(`${right.scope}:${right.scopeId}`),
    ),
});

/**
 * {@link FlagStorePort} on `feature_flag` and `feature_flag_override`, platform tables (D108): this file is on the
 * raw-data allow-list for that reason. A change locks the flag row, reads the state before, writes, and reads the
 * state after in one transaction, so the audit line shows what this change did.
 */
@Injectable()
export class TypeOrmFlagStore implements FlagStorePort {
  constructor(
    @Inject(TransactionalConnection) private readonly connection: TransactionalConnection,
    @Inject(SNOWFLAKE_ID_GENERATOR) private readonly ids: IdSource,
  ) {}

  async loadSnapshot(): Promise<FlagSnapshot> {
    const manager = this.connection.rawConnection.manager;
    const [flags, overrides] = await Promise.all([manager.find(FeatureFlagEntity), manager.find(FeatureFlagOverrideEntity)]);
    const byKey = Object.fromEntries(
      flags.map((flag) => [
        flag.key,
        stateOf(
          flag,
          overrides.filter((override) => override.flagKey === flag.key),
        ),
      ]),
    );
    return { flags: byKey };
  }

  async insertMissing(seeds: readonly FlagSeed[]): Promise<number> {
    const inserted = await this.connection.rawConnection
      .createQueryBuilder()
      .insert()
      .into(FeatureFlagEntity)
      .values(seeds.map((seed) => ({ ...seed, updatedBy: null })))
      .orIgnore()
      .returning('key')
      .execute();
    return (inserted.raw as unknown[]).length;
  }

  update(key: string, patch: FlagPatch, actor: string): Promise<FlagChange | undefined> {
    return this.change(key, async (manager) => {
      await manager.update(FeatureFlagEntity, { key }, { ...patch, updatedBy: actor });
    });
  }

  setOverride(
    override: OverrideKey & { readonly enabled: boolean },
    actor: string,
  ): Promise<FlagChange | undefined> {
    return this.change(override.key, async (manager) => {
      // `id` stays out of the conflict update: an existing override keeps its id.
      await manager
        .createQueryBuilder()
        .insert()
        .into(FeatureFlagOverrideEntity)
        .values({
          id: this.ids.next(),
          flagKey: override.key,
          scope: override.scope,
          scopeId: override.scopeId,
          enabled: override.enabled,
        })
        .orUpdate(['enabled', 'updatedAt'], ['flagKey', 'scope', 'scopeId'])
        .execute();
      await manager.update(FeatureFlagEntity, { key: override.key }, { updatedBy: actor });
    });
  }

  removeOverride(override: OverrideKey, actor: string): Promise<FlagChange | undefined> {
    return this.change(override.key, async (manager) => {
      await manager.delete(FeatureFlagOverrideEntity, {
        flagKey: override.key,
        scope: override.scope,
        scopeId: override.scopeId,
      });
      await manager.update(FeatureFlagEntity, { key: override.key }, { updatedBy: actor });
    });
  }

  /** Runs `write` on a locked flag in one transaction and returns the flag before and after; undefined when it does not exist. */
  private change(
    key: string,
    write: (manager: EntityManager) => Promise<void>,
  ): Promise<FlagChange | undefined> {
    return this.connection.rawConnection.transaction(async (manager) => {
      const before = await this.read(manager, key, true);
      if (before === undefined) return undefined;
      await write(manager);
      const after = await this.read(manager, key, false);
      return after === undefined ? undefined : { before, after };
    });
  }

  private async read(manager: EntityManager, key: string, lock: boolean): Promise<FlagState | undefined> {
    const flag = await manager.findOne(FeatureFlagEntity, {
      where: { key },
      ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });
    if (flag === null) return undefined;
    return stateOf(flag, await manager.find(FeatureFlagOverrideEntity, { where: { flagKey: key } }));
  }
}
