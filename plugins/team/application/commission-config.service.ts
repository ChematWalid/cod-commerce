import {
  ACTIVITY_ACTIONS,
  type ActivityAction,
  COMMISSION_BASES,
  type CommissionBasis,
  type CommissionConfigCommand,
  type Snowflake,
  TEAM_COMMISSION_ACTIVITY_FIELDS,
  type TenantScope,
  type UpdateCommissionConfigCommand,
} from '@cod/shared';
import {
  type CommissionActivityField,
  type CommissionConfig,
  commissionActivityDiff,
  commissionChangedFields,
  createCommissionConfig,
  reviseCommissionConfig,
} from '../domain/commission-config';
import {
  CommissionInUseError,
  CommissionNameTakenError,
  CommissionNotFoundError,
  InvalidInputError,
} from '../domain/errors';
import type { OperationContext } from '../domain/ports/operation-context';
import { assertNotSelf } from '../domain/self-action';
import type { TeamActor } from '../domain/team-actor';
import type { CommissionConfigPorts } from './commission-config-ports';

/** One commission change as its activity row records it (D216). */
interface CommissionChange {
  readonly config: CommissionConfig;
  readonly action: ActivityAction;
  readonly summary: string;
  readonly changedFields: readonly CommissionActivityField[];
}

/**
 * The commission structures of a business (brief step 5): stored only, calculated by P7.S1. Every write runs in one
 * transaction under the business lock (D213), so a name check, an "in use" check and a member edit never race.
 */
export class CommissionConfigService {
  constructor(private readonly ports: CommissionConfigPorts) {}

  /** Every config of the actor's business, by name. */
  list(ctx: OperationContext, actor: TeamActor): Promise<readonly CommissionConfig[]> {
    return this.ports.commissions.list(ctx, actor.scope);
  }

  /** @throws {CommissionNotFoundError} for no such config in the actor's business. */
  async get(ctx: OperationContext, actor: TeamActor, id: Snowflake): Promise<CommissionConfig> {
    return this.found(ctx, actor.scope, id);
  }

  /** What a commission can be earned on. */
  bases(): readonly CommissionBasis[] {
    return COMMISSION_BASES;
  }

  /**
   * @throws {CommissionNameTakenError} for a name the business already uses, compared without case or extra spaces.
   * @throws {InvalidInputError} for a value out of range, or a store that is not the business's.
   */
  create(ctx: OperationContext, actor: TeamActor, command: CommissionConfigCommand): Promise<CommissionConfig> {
    return this.inLock(ctx, actor, async (transactional) => {
      const now = this.ports.clock.now();
      const config = createCommissionConfig({ id: this.ports.ids.next(), scope: actor.scope, command, now });
      await this.assertStoresOfBusiness(transactional, actor.scope, config);
      await this.assertNameFree(transactional, config);
      await this.ports.commissions.insert(transactional, actor.scope, config);
      await this.record(transactional, actor, {
        config,
        action: ACTIVITY_ACTIONS.COMMISSION_CREATED,
        summary: 'Commission created',
        // A new config sets every field.
        changedFields: TEAM_COMMISSION_ACTIVITY_FIELDS,
      });
      return config;
    });
  }

  /**
   * @throws {CommissionNotFoundError} for no such config in the actor's business.
   * @throws {SelfActionError} for a commission given to the actor's own member row (D212).
   * @throws {CommissionNameTakenError} or {InvalidInputError} as {@link create} does.
   */
  update(
    ctx: OperationContext,
    actor: TeamActor,
    id: Snowflake,
    patch: UpdateCommissionConfigCommand,
  ): Promise<CommissionConfig> {
    return this.inLock(ctx, actor, async (transactional) => {
      const config = await this.found(transactional, actor.scope, id);
      await this.assertNotOwnCommission(transactional, actor, id);
      const revised = reviseCommissionConfig(config, patch, this.ports.clock.now());
      await this.assertStoresOfBusiness(transactional, actor.scope, revised);
      if (revised.nameKey !== config.nameKey) await this.assertNameFree(transactional, revised);
      await this.ports.commissions.update(transactional, actor.scope, revised);
      await this.record(transactional, actor, {
        config: revised,
        action: ACTIVITY_ACTIONS.COMMISSION_UPDATED,
        summary: 'Commission updated',
        changedFields: commissionChangedFields(config, revised),
      });
      return revised;
    });
  }

  /**
   * @throws {CommissionNotFoundError} for no such config in the actor's business.
   * @throws {CommissionInUseError} while a live member (invited, active or inactive) is given it.
   */
  delete(ctx: OperationContext, actor: TeamActor, id: Snowflake): Promise<void> {
    return this.inLock(ctx, actor, async (transactional) => {
      const config = await this.found(transactional, actor.scope, id);
      const members = await this.ports.members.listLive(transactional, actor.scope);
      if (members.some((member) => member.commissionConfigIds.includes(id))) throw new CommissionInUseError();
      await this.ports.commissions.delete(transactional, actor.scope, id);
      await this.record(transactional, actor, {
        config,
        action: ACTIVITY_ACTIONS.COMMISSION_DELETED,
        summary: 'Commission deleted',
        changedFields: [],
      });
    });
  }

  private inLock<T>(
    ctx: OperationContext,
    actor: TeamActor,
    work: (transactional: OperationContext) => Promise<T>,
  ): Promise<T> {
    return this.ports.transaction.run(ctx, actor.scope, async (transactional) => {
      await this.ports.lock.acquire(transactional, actor.scope);
      return work(transactional);
    });
  }

  private async found(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<CommissionConfig> {
    const config = await this.ports.commissions.findById(ctx, scope, id);
    if (config === undefined) throw new CommissionNotFoundError();
    return config;
  }

  private async assertNameFree(ctx: OperationContext, config: CommissionConfig): Promise<void> {
    const holder = await this.ports.commissions.findByNameKey(ctx, { businessId: config.businessId }, config.nameKey);
    if (holder !== undefined && holder.id !== config.id) throw new CommissionNameTakenError();
  }

  /** A commission names stores of its own business only; an archived one still counts as the business's. */
  private async assertStoresOfBusiness(
    ctx: OperationContext,
    scope: TenantScope,
    config: CommissionConfig,
  ): Promise<void> {
    const stores = await this.ports.stores.storeNames(ctx, scope);
    if (!config.storeIds.every((storeId) => stores.has(storeId))) throw new InvalidInputError();
  }

  /** Changing a commission the actor is given would change its own pay terms (D212). */
  private async assertNotOwnCommission(ctx: OperationContext, actor: TeamActor, id: Snowflake): Promise<void> {
    const members = await this.ports.members.listLive(ctx, actor.scope);
    for (const member of members) {
      if (member.commissionConfigIds.includes(id)) assertNotSelf(actor.administratorId, member);
    }
  }

  private record(ctx: OperationContext, actor: TeamActor, change: CommissionChange): Promise<void> {
    return this.ports.activity.recordCommission(ctx, {
      scope: actor.scope,
      actorAdministratorId: actor.administratorId,
      action: change.action,
      summary: change.summary,
      diff: commissionActivityDiff(change.config, change.changedFields),
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  }
}
