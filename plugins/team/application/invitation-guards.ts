import type { ActivityAction, Snowflake, TenantScope } from '@cod/shared';
import {
  CommissionNotFoundError,
  InvalidInputError,
  MemberNotFoundError,
  MemberNotPendingError,
} from '../domain/errors';
import type { Invitation } from '../domain/invitation';
import { type MemberActivityField, memberActivityDiff } from '../domain/member-activity';
import type { MemberGrant } from '../domain/member-grant';
import { type ActorReachView, isMemberInReach } from '../domain/member-reach';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import type { TeamMember } from '../domain/team-member';
import type { TeamInvitationPorts } from './invitation-ports';

/** An invited member with its most recent invitation. */
export interface PendingMember {
  readonly member: TeamMember;
  readonly invitation: Invitation | undefined;
}

/** Whether the actor reaches a grant (D211); an unknown grant counts as one without stores, for all-store actors only. */
export function reachesGrant(reach: ActorReachView, grant: MemberGrant | undefined): boolean {
  return isMemberInReach(reach, grant?.storeIds ?? [], grant?.storeAccess === 'all');
}

/**
 * The grant a member is known to hold without asking rbac: an invited member's invitation grant, an inactive one's
 * snapshot. An active member's access lives in rbac only (D204), so it is unknown here.
 */
function knownGrantOf(member: TeamMember, invitation: Invitation | undefined): MemberGrant | undefined {
  if (member.status === 'invited') return invitation?.grant;
  return member.suspendedAccess ?? undefined;
}

/**
 * The live member `memberId` of the actor's business, if the actor reaches it, and its latest invitation; it must
 * still be invited.
 *
 * @throws {MemberNotFoundError} for no such live member, or one outside the actor's reach (D211).
 * @throws {MemberNotPendingError} for a member that is not invited.
 */
export async function pendingMemberInReach(
  ports: Pick<TeamInvitationPorts, 'members' | 'invitations' | 'access'>,
  ctx: OperationContext,
  actor: TeamActor,
  memberId: Snowflake,
): Promise<PendingMember> {
  const member = await ports.members.findById(ctx, actor.scope, memberId);
  if (member === undefined || member.removedAt !== null) throw new MemberNotFoundError();
  const invitation = await ports.invitations.latestOfMember(ctx, actor.scope, member.id);
  if (!reachesGrant(await ports.access.reachOf(ctx, actor), knownGrantOf(member, invitation))) {
    throw new MemberNotFoundError();
  }
  if (member.status !== 'invited') throw new MemberNotPendingError();
  return { member, invitation };
}

/**
 * Refuses a grant the actor could not give: rbac judges roles, stores and privileges (D208), then the store reach of
 * a store-limited actor (D211).
 *
 * @throws a rbac `DomainError` for a refusal of rbac, {@link InvalidInputError} for a grant beyond the actor's reach.
 */
export async function assertGrantAllowed(
  ports: Pick<TeamInvitationPorts, 'access'>,
  ctx: OperationContext,
  actor: TeamActor,
  grant: MemberGrant,
): Promise<void> {
  await ports.access.preview(ctx, actor, grant);
  if (!reachesGrant(await ports.access.reachOf(ctx, actor), grant)) throw new InvalidInputError();
}

/** @throws {CommissionNotFoundError} when one of the ids names no commission config of the business. */
export async function assertCommissionsExist(
  ports: Pick<TeamInvitationPorts, 'commissions'>,
  ctx: OperationContext,
  scope: TenantScope,
  commissionConfigIds: readonly Snowflake[],
): Promise<void> {
  for (const id of commissionConfigIds) {
    if ((await ports.commissions.findById(ctx, scope, id)) === undefined) throw new CommissionNotFoundError();
  }
}

/** An invitation link to mail: the member it goes to, the invitation it opens and the raw token (D205). */
export interface InvitationLink {
  readonly member: TeamMember;
  readonly invitation: Pick<Invitation, 'businessId' | 'locale' | 'invitedByAdministratorId'>;
  readonly token: string;
}

/** Mails an invitation link. The mail is queued after the transaction in `ctx` commits, never on rollback. */
export async function mailInvitation(
  ports: Pick<TeamInvitationPorts, 'mail' | 'names'>,
  ctx: OperationContext,
  { member, invitation, token }: InvitationLink,
): Promise<void> {
  const scope = { businessId: invitation.businessId };
  const businessName = await ports.names.businessName(ctx, scope);
  const inviterName = await ports.names.administratorName(ctx, scope, invitation.invitedByAdministratorId);
  await ports.mail.sendInvitation(ctx, {
    to: member.email,
    locale: invitation.locale,
    token,
    // An inviter gone since still sent the invitation on the business's behalf.
    inviterName: inviterName ?? businessName,
    businessName,
  });
}

/** What one member activity row records. */
export interface MemberActivityInput {
  readonly scope: TenantScope;
  readonly actorAdministratorId: number | null;
  readonly origin: Pick<TeamActor, 'ip' | 'userAgent'>;
  readonly action: ActivityAction;
  readonly summary: string;
  readonly member: Pick<TeamMember, 'id' | 'firstName' | 'lastName'>;
  readonly changedFields?: readonly MemberActivityField[];
}

/** Records a member activity row in the transaction `ctx` carries (D216). */
export function recordMemberActivity(
  ports: Pick<TeamInvitationPorts, 'activity'>,
  ctx: OperationContext,
  input: MemberActivityInput,
): Promise<void> {
  return ports.activity.recordMember(ctx, {
    scope: input.scope,
    actorAdministratorId: input.actorAdministratorId,
    action: input.action,
    summary: input.summary,
    diff: memberActivityDiff(input.member, input.changedFields ?? []),
    ip: input.origin.ip,
    userAgent: input.origin.userAgent,
  });
}
