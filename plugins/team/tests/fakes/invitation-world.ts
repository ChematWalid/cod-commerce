import { DomainError, type TenantScope } from '@cod/shared';
import type { TeamInvitationPorts } from '../../application/invitation-ports';
import { AccountElsewhereError } from '../../domain/errors';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import type { TransactionPort } from '../../domain/ports/transaction.port';
import type { TeamActor } from '../../domain/team-actor';
import { commissionConfig, scopeA, T0 } from '../support/builders';
import { builderIds } from './converge-fakes';
import { InMemoryInvitationRepository } from './in-memory-invitation-repository';
import { InMemoryMemberRepository } from './in-memory-member-repository';
import {
  type CallLog,
  fakeNames,
  FakeMemberAccess,
  FakeMemberAccounts,
  RecordingActivity,
  RecordingLock,
  RecordingMail,
  SequentialTokens,
} from './invitation-fakes';

/** A refusal as rbac raises it: a `DomainError` with one of rbac's codes. */
export class RbacRefusal extends DomainError {
  constructor(readonly code: string) {
    super(`rbac refused: ${code}`);
  }
}

/** The fakes a test arranges and asserts on, and the ports the use cases take. */
export interface InvitationWorld {
  readonly ctx: OperationContext;
  readonly log: CallLog;
  readonly members: InMemoryMemberRepository;
  readonly invitations: InMemoryInvitationRepository;
  readonly access: FakeMemberAccess;
  readonly accounts: FakeMemberAccounts;
  readonly mail: RecordingMail;
  readonly activity: RecordingActivity;
  readonly clock: { now: Date };
  readonly ports: TeamInvitationPorts;
}

/** Undoes every fake's writes when the work fails, as a real transaction would; a mail is queued only on commit. */
class RollbackTransaction implements TransactionPort {
  constructor(private readonly world: () => InvitationWorld) {}

  async run<T>(
    ctx: OperationContext,
    _scope: TenantScope,
    work: (transactional: OperationContext) => Promise<T>,
  ): Promise<T> {
    const { members, invitations, mail, activity, accounts, access } = this.world();
    const before = {
      members: [...members.rows],
      invitations: [...invitations.rows],
      sent: mail.sent.length,
      rows: activity.rows.length,
      created: accounts.created.length,
      verified: accounts.verified.length,
      grants: access.grants.length,
    };
    try {
      return await work(ctx);
    } catch (error: unknown) {
      members.rows.splice(0, members.rows.length, ...before.members);
      invitations.rows = before.invitations;
      mail.sent.splice(before.sent);
      activity.rows.splice(before.rows);
      accounts.created.splice(before.created);
      accounts.verified.splice(before.verified);
      access.grants.splice(before.grants);
      throw error;
    }
  }
}

/** A fresh world: business A has one commission config, `commissionId`; the clock starts at {@link T0}. */
export function invitationWorld(): InvitationWorld & { readonly commissionId: string } {
  const log: CallLog = [];
  const clock = { now: T0 };
  const commission = commissionConfig(scopeA);
  const invitations = new InMemoryInvitationRepository();
  const holder: { world?: InvitationWorld } = {};
  const ports: TeamInvitationPorts = {
    members: new InMemoryMemberRepository(),
    invitations,
    lookup: invitations,
    commissions: {
      findById: (_ctx, scope, id) =>
        Promise.resolve(scope.businessId === commission.businessId && id === commission.id ? commission : undefined),
    },
    access: new FakeMemberAccess(log),
    accounts: new FakeMemberAccounts(log, () => new AccountElsewhereError()),
    mail: new RecordingMail(),
    names: fakeNames,
    tokens: new SequentialTokens(),
    lock: new RecordingLock(log),
    transaction: new RollbackTransaction(() => holder.world as InvitationWorld),
    activity: new RecordingActivity(),
    ids: builderIds,
    clock: { now: () => clock.now },
  };
  const world: InvitationWorld = {
    ctx: asOperationContext({}),
    log,
    members: ports.members as InMemoryMemberRepository,
    invitations,
    access: ports.access as FakeMemberAccess,
    accounts: ports.accounts as FakeMemberAccounts,
    mail: ports.mail as RecordingMail,
    activity: ports.activity as RecordingActivity,
    clock,
    ports,
  };
  holder.world = world;
  return { ...world, commissionId: commission.id };
}

/** The owner of business A, all stores. */
export const ownerOfA: TeamActor = { administratorId: 1, scope: scopeA, ip: '192.0.2.1', userAgent: 'test' };
