import { type Snowflake, type TenantScope, toSnowflake } from '@cod/shared';
import type { MemberActionPorts } from '../../application/member-action-ports';
import type { MemberGrant } from '../../domain/member-grant';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import type { SalaryPaidPublisherPort } from '../../domain/ports/salary-paid-publisher.port';
import type { TransactionPort } from '../../domain/ports/transaction.port';
import type { SalaryPayment } from '../../domain/salary-payment';
import type { TeamActor } from '../../domain/team-actor';
import type { TeamMember } from '../../domain/team-member';
import { commissionConfig, invitedMember, openInvitation, scopeA, T0 } from '../support/builders';
import { builderIds } from './converge-fakes';
import { InMemoryInvitationRepository } from './in-memory-invitation-repository';
import { InMemoryMemberRepository } from './in-memory-member-repository';
import { InMemorySalaryPaymentRepository } from './in-memory-salary-payment-repository';
import {
  type CallLog,
  FakeMemberAccess,
  FakeMemberAccounts,
  RecordingActivity,
  RecordingLock,
} from './invitation-fakes';

/** Store 1 and store 2 of business A, and two of its roles. */
export const S1 = toSnowflake('11');
export const S2 = toSnowflake('12');
export const AGENT_ROLE = toSnowflake('901');
export const OWNER_ROLE = toSnowflake('900');
/** The business owner's administrator id; {@link ownerOfA} in the invitation tests. */
export const OWNER_ID = 1;

/** The salary-paid events published (the outbox rows the paying transaction would write). */
export class RecordingSalaryPaid implements SalaryPaidPublisherPort {
  readonly published: SalaryPayment[] = [];
  readonly recipients: number[] = [];

  publish(_ctx: OperationContext, _scope: TenantScope, payment: SalaryPayment, administratorId: number): Promise<void> {
    this.published.push(payment);
    this.recipients.push(administratorId);
    return Promise.resolve();
  }
}

/** The fakes a test arranges and asserts on, and the ports the member actions take. */
export interface MemberActionWorld {
  readonly ctx: OperationContext;
  readonly log: CallLog;
  readonly members: InMemoryMemberRepository;
  readonly invitations: InMemoryInvitationRepository;
  readonly access: FakeMemberAccess;
  readonly accounts: FakeMemberAccounts;
  readonly salaries: InMemorySalaryPaymentRepository;
  readonly salaryPaid: RecordingSalaryPaid;
  readonly activity: RecordingActivity;
  readonly commissionId: Snowflake;
  readonly clock: { now: Date };
  readonly ports: MemberActionPorts;
}

/** Undoes the fakes' writes when the work fails, as a real transaction would; events reach nobody on rollback. */
class RollbackTransaction implements TransactionPort {
  constructor(private readonly world: () => MemberActionWorld) {}

  async run<T>(ctx: OperationContext, _s: TenantScope, work: (t: OperationContext) => Promise<T>): Promise<T> {
    const { members, salaries, salaryPaid, activity, access, accounts } = this.world();
    const before = {
      members: [...members.rows],
      salaries: [...salaries.rows],
      published: salaryPaid.published.length,
      rows: activity.rows.length,
      held: new Map(access.held),
      softDeleted: accounts.softDeleted.length,
    };
    try {
      return await work(ctx);
    } catch (error: unknown) {
      members.rows.splice(0, members.rows.length, ...before.members);
      salaries.rows.splice(0, salaries.rows.length, ...before.salaries);
      salaryPaid.published.splice(before.published);
      activity.rows.splice(before.rows);
      access.held.clear();
      for (const [id, grant] of before.held) access.held.set(id, grant);
      accounts.softDeleted.splice(before.softDeleted);
      throw error;
    }
  }
}

/** A fresh business A: its owner is {@link OWNER_ID}, it has one commission config; the clock is {@link T0}. */
export function memberActionWorld(): MemberActionWorld {
  const log: CallLog = [];
  const clock = { now: T0 };
  const commission = commissionConfig(scopeA);
  const holder: { world?: MemberActionWorld } = {};
  const members = new InMemoryMemberRepository();
  const invitations = new InMemoryInvitationRepository();
  const access = new FakeMemberAccess(log);
  const accounts = new FakeMemberAccounts(log, () => new Error('unused'));
  const salaries = new InMemorySalaryPaymentRepository();
  const salaryPaid = new RecordingSalaryPaid();
  const activity = new RecordingActivity();
  const ports: MemberActionPorts = {
    members,
    invitations,
    commissions: {
      findById: (_c, scope, id) =>
        Promise.resolve(scope.businessId === commission.businessId && id === commission.id ? commission : undefined),
    },
    access,
    accounts,
    owner: { ownerAdministratorId: () => Promise.resolve(OWNER_ID) },
    salaries,
    salaryPaid,
    lock: new RecordingLock(log),
    transaction: new RollbackTransaction(() => holder.world as MemberActionWorld),
    activity,
    ids: builderIds,
    clock: { now: () => clock.now },
  };
  const world: MemberActionWorld = {
    ctx: asOperationContext({}),
    log,
    members,
    invitations,
    access,
    accounts,
    salaries,
    salaryPaid,
    activity,
    commissionId: commission.id,
    clock,
    ports,
  };
  holder.world = world;
  return world;
}

/** An active member of A holding `grant` in rbac. */
export async function activeMember(
  world: MemberActionWorld,
  administratorId: number,
  grant: MemberGrant = { roleIds: [AGENT_ROLE], storeAccess: 'selected', storeIds: [S1] },
  overrides: Partial<TeamMember> = {},
): Promise<TeamMember> {
  const member = invitedMember(scopeA, {
    status: 'active',
    administratorId,
    firstName: 'Amina',
    lastName: 'Bensalem',
    joinedAt: T0,
    ...overrides,
  });
  await world.members.insert(world.ctx, scopeA, member);
  if (grant.roleIds.length > 0) world.access.held.set(administratorId, grant);
  return member;
}

/** A deactivated member of A whose former grant is `snapshot`; rbac holds nothing for it. */
export async function inactiveMember(
  world: MemberActionWorld,
  administratorId: number,
  snapshot: MemberGrant = { roleIds: [AGENT_ROLE], storeAccess: 'selected', storeIds: [S1] },
): Promise<TeamMember> {
  return activeMember(
    world,
    administratorId,
    { roleIds: [], storeAccess: 'selected', storeIds: [] },
    {
      status: 'inactive',
      suspendedAccess: snapshot,
    },
  );
}

/** An invited member of A whose open invitation grants `grant`. */
export async function pendingMember(
  world: MemberActionWorld,
  grant: MemberGrant = { roleIds: [AGENT_ROLE], storeAccess: 'selected', storeIds: [S1] },
): Promise<TeamMember> {
  const member = invitedMember(scopeA);
  await world.members.insert(world.ctx, scopeA, member);
  await world.invitations.insert(
    world.ctx,
    scopeA,
    openInvitation(member, { grant, tokenHash: member.id.padEnd(64, '0') }),
  );
  return member;
}

/** An all-store actor of A other than the owner. */
export const managerOfA: TeamActor = { administratorId: 2, scope: scopeA, ip: '192.0.2.2', userAgent: 'test' };
/** The owner of A, all stores. */
export const theOwner: TeamActor = { administratorId: OWNER_ID, scope: scopeA, ip: '192.0.2.1', userAgent: 'test' };
