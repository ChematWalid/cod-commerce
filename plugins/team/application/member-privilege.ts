import type { MemberGrant } from '../domain/member-grant';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import type { MemberActionPorts } from './member-action-ports';

/**
 * Refuses an action on a member whose roles the actor could not change (D60.4, D60.7): a Manager neither removes a
 * deactivated co-owner nor edits an Owner holder's pay. `grant` is what the member holds (D204): rbac's current
 * access or the deactivation snapshot. rbac judges what remains of it, so a role deleted or a store archived since
 * never lets an actor through; only revoking a dead invitation may skip a grant gone since.
 *
 * @throws a rbac `DomainError` for a member the actor could not change.
 */
export async function assertMayActOnMember(
  ports: Pick<MemberActionPorts, 'access'>,
  ctx: OperationContext,
  actor: TeamActor,
  grant: MemberGrant,
): Promise<void> {
  if (grant.roleIds.length === 0) return;
  await ports.access.assertMayChangeHolder(ctx, actor, grant);
}
