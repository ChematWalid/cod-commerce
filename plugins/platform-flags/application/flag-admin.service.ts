import { type FlagKey, isFlagKey } from '@cod/shared';
import {
  FLAG_DESCRIPTION_MAX_LENGTH,
  FLAG_REDELETE_DELAY_MS,
  OVERRIDE_SCOPE_ID_MAX_LENGTH,
  ROLLOUT_MAX_PERCENT,
  ROLLOUT_MIN_PERCENT,
  SNOWFLAKE_PATTERN,
} from '../domain/constants';
import {
  InvalidDescriptionError,
  InvalidPlanKeyError,
  InvalidRolloutError,
  UnknownFlagKeyError,
  UnknownScopeTargetError,
} from '../domain/errors';
import type { FlagChange, FlagPatch, OverrideKey } from '../domain/ports/flag-store.port';
import type { FlagState, OverrideScope } from '../domain/snapshot';
import type { FeatureFlags } from './feature-flags.service';
import type { FlagAdminPorts } from './ports';

/** A flag as staff see it. */
export interface FlagView extends FlagState {
  readonly key: string;
}

/** The fields staff may change on a flag. */
export interface UpdateFlagInput extends FlagPatch {
  readonly key: string;
}

/** An override to create or replace. */
export interface SetOverrideInput {
  readonly key: string;
  readonly scope: OverrideScope;
  readonly scopeId: string;
  readonly enabled: boolean;
}

const summary = (state: FlagState): string =>
  JSON.stringify({
    defaultEnabled: state.defaultEnabled,
    rolloutPercent: state.rolloutPercent,
    description: state.description,
    overrides: state.overrides.map((override) => `${override.scope}:${override.scopeId}=${String(override.enabled)}`),
  });

const isRollout = (value: number): boolean =>
  Number.isInteger(value) && value >= ROLLOUT_MIN_PERCENT && value <= ROLLOUT_MAX_PERCENT;

/**
 * Staff changes to flags (D116). Every change is checked, committed, logged with actor, key, before and after (no
 * tenant activity log: a flag has no business), and then announced: the shared snapshot is deleted and the other
 * processes told, again after 500 ms for a reader that cached the old snapshot in between. Valkey being down never
 * fails a change: the database holds it and the other processes read it within one snapshot life.
 */
export class FlagAdminService {
  constructor(
    private readonly ports: FlagAdminPorts,
    private readonly flags: FeatureFlags,
  ) {}

  /** Every flag with its overrides, straight from the database. */
  async list(): Promise<readonly FlagView[]> {
    const { flags } = await this.ports.store.loadSnapshot();
    return Object.keys(flags)
      .sort()
      .map((key) => ({ key, ...(flags[key] as FlagState) }));
  }

  async update(actor: string, input: UpdateFlagInput): Promise<FlagView> {
    this.requireKnown(input.key);
    const patch = this.validated(input);
    return this.committed(actor, input.key, 'update', await this.ports.store.update(input.key, patch, actor));
  }

  async setOverride(actor: string, input: SetOverrideInput): Promise<FlagView> {
    this.requireKnown(input.key);
    await this.requireTarget(input.scope, input.scopeId);
    const change = await this.ports.store.setOverride(input, actor);
    return this.committed(actor, input.key, 'set override', change);
  }

  async removeOverride(actor: string, input: OverrideKey): Promise<FlagView> {
    this.requireKnown(input.key);
    const change = await this.ports.store.removeOverride(input, actor);
    return this.committed(actor, input.key, 'remove override', change);
  }

  /** What `key` answers for the given business and store, through the cache the services use. */
  async evaluate(key: string, businessId: string | undefined, storeId: string | undefined): Promise<boolean> {
    this.requireKnown(key);
    return this.flags.isEnabledFor(
      { ...(businessId === undefined ? {} : { businessId }), ...(storeId === undefined ? {} : { storeId }) },
      key,
    );
  }

  private requireKnown(key: string): asserts key is FlagKey {
    if (!isFlagKey(key)) throw new UnknownFlagKeyError();
  }

  private validated(input: UpdateFlagInput): FlagPatch {
    if (input.rolloutPercent !== undefined && !isRollout(input.rolloutPercent)) throw new InvalidRolloutError();
    if (
      input.description !== undefined &&
      (input.description.trim() === '' || input.description.length > FLAG_DESCRIPTION_MAX_LENGTH)
    ) {
      throw new InvalidDescriptionError();
    }
    return {
      ...(input.defaultEnabled === undefined ? {} : { defaultEnabled: input.defaultEnabled }),
      ...(input.rolloutPercent === undefined ? {} : { rolloutPercent: input.rolloutPercent }),
      ...(input.description === undefined ? {} : { description: input.description.trim() }),
    };
  }

  /** A business or store override must name a row that exists; a plan key is free text until P9.S1. */
  private async requireTarget(scope: OverrideScope, scopeId: string): Promise<void> {
    if (scope === 'plan') {
      if (scopeId.trim() === '' || scopeId.length > OVERRIDE_SCOPE_ID_MAX_LENGTH) throw new InvalidPlanKeyError();
      return;
    }
    const exists =
      SNOWFLAKE_PATTERN.test(scopeId) &&
      (scope === 'business'
        ? await this.ports.directory.businessExists(scopeId)
        : await this.ports.directory.activeStoreExists(scopeId));
    if (!exists) throw new UnknownScopeTargetError();
  }

  private async committed(
    actor: string,
    key: string,
    action: string,
    change: FlagChange | undefined,
  ): Promise<FlagView> {
    if (change === undefined) throw new UnknownFlagKeyError();
    this.ports.logger.info(
      `Feature flag ${key} ${action} by ${actor}: before ${summary(change.before)}, after ${summary(change.after)}`,
    );
    await this.announce();
    return { key, ...change.after };
  }

  /** Drops this process's snapshot, deletes the shared one and tells the others; repeated once after a short delay. */
  private async announce(): Promise<void> {
    this.flags.forget();
    if (!(await this.ports.cache.invalidate())) {
      this.ports.logger.error(
        'Feature flag change committed but Valkey could not be told; other processes see it within 30 s',
      );
    }
    setTimeout(() => {
      this.flags.forget();
      void this.ports.cache.invalidate();
    }, FLAG_REDELETE_DELAY_MS).unref();
  }
}
