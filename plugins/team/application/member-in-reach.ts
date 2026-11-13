import type { Snowflake } from '@cod/shared';
import { MemberNotFoundError } from '../domain/errors';
import { grantOfMember } from '../domain/member-details';
import type { MemberGrant } from '../domain/member-grant';
import type { ActorReachView } from '../domain/member-reach';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import type { TeamMember } from '../domain/team-member';
import { reachesGrant } from './invitation-guards';
import type { MemberActionPorts } from './member-action-ports';

/** A live member the actor reaches, what it holds or is to hold (D204), and the actor's reach. */
export interface MemberInReach {
  readonly member: TeamMember;
  readonly grant: MemberGrant;
  readonly reach: ActorReachView;
}

/** Which member to read, and whether to lock its row until the transaction ends (D212). */
interface MemberTarget {
  readonly id: Snowflake;
  readonly forUpdate: boolean;
}

type ReachPorts = Pick<MemberActionPorts, 'members' | 'invitations' | 'access'>;

/**
 * The live member `id` of the actor's business, if the actor reaches it (D211). Its grant is the invitation's for an
 * invited member, the snapshot for an inactive one and rbac's current access for an active one.
 *
 * @throws {MemberNotFoundError} for no such live member, or one outside the actor's reach.
 */
export function liveMemberInReach(
  ports: ReachPorts,
  ctx: OperationContext,
  actor: TeamActor,
  id: Snowflake,
): Promise<MemberInReach> {
  return memberInReach(ports, ctx, actor, { id, forUpdate: false });
}

/**
 * {@link liveMemberInReach} with the member's row locked until the transaction in `ctx` ends, so what is read from it
 * (a salary) cannot change before the work commits (D212).
 *
 * @throws {MemberNotFoundError} for no such live member, or one outside the actor's reach.
 */
export function lockedMemberInReach(
  ports: ReachPorts,
  ctx: OperationContext,
  actor: TeamActor,
  id: Snowflake,
): Promise<MemberInReach> {
  return memberInReach(ports, ctx, actor, { id, forUpdate: true });
}

async function memberInReach(
  ports: ReachPorts,
  ctx: OperationContext,
  actor: TeamActor,
  { id, forUpdate }: MemberTarget,
): Promise<MemberInReach> {
  const { members, invitations, access } = ports;
  const member = await (forUpdate
    ? members.findForUpdate(ctx, actor.scope, id)
    : members.findById(ctx, actor.scope, id));
  if (member === undefined || member.removedAt !== null) throw new MemberNotFoundError();
  const invitation =
    member.status === 'invited' ? await invitations.latestOfMember(ctx, actor.scope, member.id) : undefined;
  const held =
    member.status === 'active' && member.administratorId !== null
      ? await access.accessOf(ctx, actor.scope, member.administratorId)
      : undefined;
  const grant = grantOfMember(member, invitation, held);
  const reach = await access.reachOf(ctx, actor);
  if (!reachesGrant(reach, grant)) throw new MemberNotFoundError();
  return { member, grant, reach };
}

/**
 * The member's administrator account. Every active or inactive member holds one (D200); only an invited member has
 * none, and the actions that need one refuse it first.
 *
 * @throws {MemberNotFoundError} for a member without an account.
 */
export function administratorOf(member: Pick<TeamMember, 'administratorId'>): number {
  if (member.administratorId === null) throw new MemberNotFoundError();
  return member.administratorId;
}
