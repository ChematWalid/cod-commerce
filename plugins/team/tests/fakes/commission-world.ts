import { type Snowflake, type TenantScope, toSnowflake } from '@cod/shared';
import type { CommissionConfigPorts } from '../../application/commission-config-ports';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import type { TransactionPort } from '../../domain/ports/transaction.port';
import type { TeamActor } from '../../domain/team-actor';
import { scopeA, scopeB, T0 } from '../support/builders';
import { builderIds } from './converge-fakes';
import { InMemoryCommissionConfigRepository } from './in-memory-commission-config-repository';
import { InMemoryMemberRepository } from './in-memory-member-repository';
import { type CallLog, RecordingActivity, RecordingLock } from './invitation-fakes';

/** Stores 1 and 2 of business A, store 3 of business B. */
export const STORE_A1 = toSnowflake('11');
export const STORE_A2 = toSnowflake('12');
export const STORE_B1 = toSnowflake('21');

const STORES_OF: ReadonlyMap<string, ReadonlyMap<Snowflake, string>> = new Map([
  [
    scopeA.businessId,
    new Map([
      [STORE_A1, 'Alger'],
      [STORE_A2, 'Oran'],
    ]),
  ],
  [scopeB.businessId, new Map([[STORE_B1, 'Constantine']])],
]);

/** The fakes a commission test arranges and asserts on, and the ports the service takes. */
export interface CommissionWorld {
  readonly ctx: OperationContext;
  readonly log: CallLog;
  readonly commissions: InMemoryCommissionConfigRepository;
  readonly members: InMemoryMemberRepository;
  readonly activity: RecordingActivity;
  readonly ports: CommissionConfigPorts;
}

/** Undoes the fakes' writes when the work fails, as a real transaction would. */
class RollbackTransaction implements TransactionPort {
  constructor(private readonly world: () => CommissionWorld) {}

  async run<T>(ctx: OperationContext, _s: TenantScope, work: (t: OperationContext) => Promise<T>): Promise<T> {
    const { commissions, activity, log } = this.world();
    const before = { rows: [...commissions.rows], activity: activity.commissionRows.length };
    log.push('begin');
    try {
      return await work(ctx);
    } catch (error: unknown) {
      commissions.rows.splice(0, commissions.rows.length, ...before.rows);
      activity.commissionRows.splice(before.activity);
      throw error;
    }
  }
}

/** Fresh businesses A (stores 1 and 2) and B (store 3), with no commission yet; the clock is {@link T0}. */
export function commissionWorld(): CommissionWorld {
  const log: CallLog = [];
  const holder: { world?: CommissionWorld } = {};
  const commissions = new InMemoryCommissionConfigRepository();
  const members = new InMemoryMemberRepository();
  const activity = new RecordingActivity();
  const ports: CommissionConfigPorts = {
    commissions,
    members,
    stores: { storeNames: (_ctx, scope) => Promise.resolve(STORES_OF.get(scope.businessId) ?? new Map()) },
    lock: new RecordingLock(log),
    transaction: new RollbackTransaction(() => holder.world as CommissionWorld),
    activity,
    ids: builderIds,
    clock: { now: () => T0 },
  };
  const world = { ctx: asOperationContext({}), log, commissions, members, activity, ports };
  holder.world = world;
  return world;
}

/** An all-store actor of A, and one of B. */
export const actorOfA: TeamActor = { administratorId: 2, scope: scopeA, ip: '192.0.2.2', userAgent: 'test' };
export const actorOfB: TeamActor = { administratorId: 7, scope: scopeB, ip: '192.0.2.7', userAgent: 'test' };
