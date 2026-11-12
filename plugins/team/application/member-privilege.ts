import type { MemberGrant } from '../domain/member-grant';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import { assertWithdrawAllowed } from './invitation-guards';
import type { MemberActionPorts } from './member-action-ports';

/**
 * Refuses an action on a member whose roles the actor could not grant (D60.3, D60.7): a Manager neither removes a
 * deactivated co-owner nor edits an Owner holder's pay. `grant` is what the member holds or is to hold (D204): rbac's
 * current access, the deactivation snapshot or the invitation. A member holding no role gives nothing away; neither
 * does a grant gone since (a role deleted, a store archived), as for revoke.
 *
 * @throws a rbac `DomainError` for a member the actor could not have given its roles.
 */
export async function assertMayActOnMember(
  ports: Pick<MemberActionPorts, 'access'>,
  ctx: OperationContext,
  actor: TeamActor,
  grant: MemberGrant,
): Promise<void> {
  if (grant.roleIds.length === 0) return;
  await assertWithdrawAllowed(ports, ctx, actor, grant);
}
