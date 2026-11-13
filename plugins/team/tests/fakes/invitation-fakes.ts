import type { TeamEmailLocale, TenantScope } from '@cod/shared';
import type { MemberGrant, MemberStoreGrant } from '../../domain/member-grant';
import type { ActorReachView } from '../../domain/member-reach';
import type { BusinessLockPort } from '../../domain/ports/business-lock.port';
import type { BusinessNamesPort } from '../../domain/ports/business-names.port';
import type { InvitationMail, InvitationMailPort } from '../../domain/ports/invitation-mail.port';
import type { InvitationTokenPort } from '../../domain/ports/invitation-token.port';
import type { MemberAccessPort } from '../../domain/ports/member-access.port';
import type { MemberAccountPort, NewMemberAccount } from '../../domain/ports/member-account.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import type {
  TeamActivityPort,
  TeamCommissionActivity,
  TeamMemberActivity,
} from '../../domain/ports/team-activity.port';
import type { TeamActor } from '../../domain/team-actor';

/** Every call the fakes saw, in order, so a test can assert what ran before what (D213). */
export type CallLog = string[];

/** rbac's access as a fake: a fixed reach, and refusals a test arms. */
export class FakeMemberAccess implements MemberAccessPort {
  reach: ActorReachView = { allStores: true, storeIds: [] };
  /** What each administrator holds in rbac now; a successful `setAccess` replaces it. */
  readonly held = new Map<number, MemberGrant>();
  previewRefusal: Error | undefined;
  holderRefusal: Error | undefined;
  setAccessRefusal: Error | undefined;
  readonly grants: { administratorId: number; actor: TeamActor; grant: MemberGrant }[] = [];
  readonly flushed: (readonly number[])[] = [];

  constructor(private readonly log: CallLog) {}

  holdAccess(_ctx: OperationContext, _scope: TenantScope): Promise<void> {
    this.log.push('holdAccess');
    return Promise.resolve();
  }

  preview(): Promise<void> {
    this.log.push('preview');
    return this.previewRefusal === undefined ? Promise.resolve() : Promise.reject(this.previewRefusal);
  }

  assertMayChangeHolder(): Promise<void> {
    this.log.push('assertMayChangeHolder');
    return this.holderRefusal === undefined ? Promise.resolve() : Promise.reject(this.holderRefusal);
  }

  setAccess(_ctx: OperationContext, actor: TeamActor, administratorId: number, grant: MemberGrant): Promise<void> {
    this.log.push('setAccess');
    if (this.setAccessRefusal !== undefined) return Promise.reject(this.setAccessRefusal);
    this.grants.push({ administratorId, actor, grant });
    if (grant.roleIds.length === 0) this.held.delete(administratorId);
    else this.held.set(administratorId, grant);
    return Promise.resolve();
  }

  async withdrawAccess(
    ctx: OperationContext,
    actor: TeamActor,
    administratorId: number,
    clearing: MemberStoreGrant,
  ): Promise<MemberGrant> {
    // rbac's view of a member holding no row (D804).
    const held = this.held.get(administratorId) ?? { roleIds: [], storeAccess: 'selected', storeIds: [] };
    await this.setAccess(ctx, actor, administratorId, { roleIds: [], ...clearing });
    return held;
  }

  accessOf(_ctx: OperationContext, _scope: TenantScope, administratorId: number): Promise<MemberGrant | undefined> {
    return Promise.resolve(this.held.get(administratorId));
  }

  flush(administratorIds: readonly number[]): Promise<void> {
    this.log.push('flush');
    this.flushed.push(administratorIds);
    return Promise.resolve();
  }

  reachOf(): Promise<ActorReachView> {
    return Promise.resolve(this.reach);
  }
}

/** Accounts as a fake: addresses already taken, and the accounts created. */
export class FakeMemberAccounts implements MemberAccountPort {
  readonly taken = new Set<string>();
  readonly created: (NewMemberAccount & { administratorId: number; businessId: string })[] = [];
  readonly verified: { administratorId: number; locale: TeamEmailLocale }[] = [];
  private nextAdministratorId = 500;

  constructor(
    private readonly log: CallLog,
    private readonly takenError: () => Error,
  ) {}

  assertEmailFree(_ctx: OperationContext, email: string): Promise<void> {
    this.log.push('assertEmailFree');
    return this.taken.has(email.trim().toLowerCase()) ? Promise.reject(this.takenError()) : Promise.resolve();
  }

  create(_ctx: OperationContext, scope: TenantScope, account: NewMemberAccount): Promise<number> {
    this.log.push('create');
    const administratorId = this.nextAdministratorId++;
    this.created.push({ ...account, administratorId, businessId: scope.businessId });
    return Promise.resolve(administratorId);
  }

  markVerified(_ctx: OperationContext, administratorId: number, locale: TeamEmailLocale): Promise<void> {
    this.log.push('markVerified');
    this.verified.push({ administratorId, locale });
    return Promise.resolve();
  }

  readonly softDeleted: number[] = [];

  softDelete(_ctx: OperationContext, _scope: TenantScope, administratorId: number): Promise<void> {
    this.log.push('softDelete');
    this.softDeleted.push(administratorId);
    return Promise.resolve();
  }
}

/** The mails a use case asked for; nothing is sent. */
export class RecordingMail implements InvitationMailPort {
  readonly sent: InvitationMail[] = [];

  sendInvitation(_ctx: OperationContext, mail: InvitationMail): Promise<void> {
    this.sent.push(mail);
    return Promise.resolve();
  }
}

/** Fixed names of the business and its administrators. */
export const fakeNames: BusinessNamesPort = {
  businessName: () => Promise.resolve('Atlas SARL'),
  administratorName: (_ctx, _scope, administratorId) => Promise.resolve(administratorId === 1 ? 'Amina Owner' : null),
};

/** The activity rows written. */
export class RecordingActivity implements TeamActivityPort {
  readonly rows: TeamMemberActivity[] = [];
  readonly commissionRows: TeamCommissionActivity[] = [];

  recordMember(_ctx: OperationContext, activity: TeamMemberActivity): Promise<void> {
    this.rows.push(activity);
    return Promise.resolve();
  }

  recordCommission(_ctx: OperationContext, activity: TeamCommissionActivity): Promise<void> {
    this.commissionRows.push(activity);
    return Promise.resolve();
  }
}

/** The business locks taken. */
export class RecordingLock implements BusinessLockPort {
  constructor(private readonly log: CallLog) {}

  acquire(_ctx: OperationContext, scope: TenantScope): Promise<void> {
    this.log.push(`lock:${scope.businessId}`);
    return Promise.resolve();
  }
}

/** Tokens `token-1`, `token-2`, ... and a readable stand-in for their hash. */
export class SequentialTokens implements InvitationTokenPort {
  private issued = 0;

  newToken(): string {
    this.issued += 1;
    return `token-${String(this.issued)}`;
  }

  hash(token: string): string {
    return `hash-of-${token}`.padEnd(64, '0');
  }
}
