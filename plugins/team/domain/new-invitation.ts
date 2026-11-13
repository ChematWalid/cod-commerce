import type { InviteMemberCommand, Snowflake, TenantScope } from '@cod/shared';
import { type IssuedInvitation, nextExpiry } from './invitation';
import type { MemberGrant } from './member-grant';
import { emailKeyOf, type TeamMember } from './team-member';

/** The roles and stores an invitation gives on accept (D204). */
export function grantOf(command: Pick<InviteMemberCommand, 'roleIds' | 'storeAccess' | 'storeIds'>): MemberGrant {
  return {
    roleIds: [...command.roleIds],
    storeAccess: command.storeAccess,
    storeIds: command.storeAccess === 'all' ? [] : [...command.storeIds],
  };
}

/** What {@link invitedMemberOf} needs. */
export interface InvitedMemberInput {
  readonly id: Snowflake;
  readonly scope: TenantScope;
  readonly command: InviteMemberCommand;
  readonly invitedByAdministratorId: number;
  readonly now: Date;
}

/** A member waiting on its invitation: no account and no name yet (D200), its pay terms already set. */
export function invitedMemberOf({ id, scope, command, invitedByAdministratorId, now }: InvitedMemberInput): TeamMember {
  return {
    id,
    businessId: scope.businessId,
    administratorId: null,
    email: command.email,
    emailKey: emailKeyOf(command.email),
    firstName: null,
    lastName: null,
    status: 'invited',
    suspendedAccess: null,
    commissionConfigIds: [...command.commissionConfigIds],
    baseSalary: command.baseSalary,
    maxOpenOrders: null,
    receivingOrders: true,
    invitedByAdministratorId,
    invitedAt: now,
    joinedAt: null,
    removedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** What {@link issuedInvitationOf} needs; `tokenHash` is the only form of the token kept (D205). */
export interface IssuedInvitationInput {
  readonly id: Snowflake;
  readonly member: TeamMember;
  readonly command: InviteMemberCommand;
  readonly tokenHash: string;
  readonly invitedByAdministratorId: number;
  readonly now: Date;
}

/** The invitation of a new invited member, open for the full lifetime from `now`. */
export function issuedInvitationOf(input: IssuedInvitationInput): IssuedInvitation {
  const { id, member, command, tokenHash, invitedByAdministratorId, now } = input;
  return {
    id,
    businessId: member.businessId,
    memberId: member.id,
    grant: grantOf(command),
    locale: command.locale,
    tokenHash,
    expiresAt: nextExpiry(now),
    lastSentAt: now,
    resendCount: 0,
    invitedByAdministratorId,
    revokedAt: null,
    acceptedAt: null,
    createdAt: now,
  };
}
