import type { ActivityAction } from '@cod/shared';
import type { MemberActivityField } from '../domain/member-activity';
import type { TeamMemberPatch } from '../domain/ports/member-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import type { TeamMember } from '../domain/team-member';
import { recordMemberActivity } from './invitation-guards';
import type { MemberActionPorts } from './member-action-ports';

/** What a member action leaves: the member as it now is, and the account to sign out once the change commits. */
export interface MemberChange {
  readonly member: TeamMember;
  readonly signOut?: number;
}

/**
 * Runs a member action in one transaction under the business lock, taken before any rbac lock (D213), then signs the
 * changed account out of its cached sessions once the transaction committed (D55).
 */
export async function commitMemberChange(
  ports: Pick<MemberActionPorts, 'transaction' | 'lock' | 'access'>,
  ctx: OperationContext,
  actor: TeamActor,
  work: (transactional: OperationContext) => Promise<MemberChange>,
): Promise<TeamMember> {
  const change = await ports.transaction.run(ctx, actor.scope, async (transactional) => {
    await ports.lock.acquire(transactional, actor.scope);
    return work(transactional);
  });
  if (change.signOut !== undefined) await ports.access.flush([change.signOut]);
  return change.member;
}

/** Applies `patch` to the member in its business, stamped now, and returns the member as stored. */
export async function patchMember(
  ports: Pick<MemberActionPorts, 'members' | 'clock'>,
  ctx: OperationContext,
  member: TeamMember,
  patch: TeamMemberPatch,
): Promise<TeamMember> {
  const stamped = { ...patch, updatedAt: ports.clock.now() };
  await ports.members.update(ctx, { businessId: member.businessId }, member.id, stamped);
  return { ...member, ...stamped };
}

/** One member action as its activity row records it (D216): the fields it changed, never their values. */
export interface MemberAction {
  readonly member: TeamMember;
  readonly action: ActivityAction;
  readonly summary: string;
  readonly changedFields: readonly MemberActivityField[];
}

/** Records the action's activity row in the transaction `ctx` carries. */
export function recordAction(
  ports: Pick<MemberActionPorts, 'activity'>,
  ctx: OperationContext,
  actor: TeamActor,
  { member, action, summary, changedFields }: MemberAction,
): Promise<void> {
  return recordMemberActivity(ports, ctx, {
    scope: actor.scope,
    actorAdministratorId: actor.administratorId,
    origin: actor,
    action,
    summary,
    member,
    changedFields,
  });
}
