import { ACTIVITY_ACTIONS, type Snowflake } from '@cod/shared';
import { invitationStateOf } from '../domain/invitation';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import type { TeamInvitationPorts } from './invitation-ports';
import { assertWithdrawAllowed, pendingMemberInReach, recordMemberActivity } from './invitation-guards';

const FINAL_STATES = new Set(['accepted', 'revoked']);

/** Withdraws a pending invitation: its link stops working and the address can be invited again. */
export class RevokeInvitationService {
  constructor(private readonly ports: TeamInvitationPorts) {}

  /**
   * Revokes the member's invitation, if still unanswered, and removes the invited member.
   *
   * @throws {MemberNotFoundError} for no such member or one out of the actor's reach (D211).
   * @throws {MemberNotPendingError} for a member that is not invited.
   * @throws a rbac `DomainError` for an invitation grant the actor could not make itself (D60).
   */
  async revoke(ctx: OperationContext, actor: TeamActor, memberId: Snowflake): Promise<void> {
    await this.ports.transaction.run(ctx, actor.scope, async (transactional) => {
      const { lock, invitations, members, clock } = this.ports;
      await lock.acquire(transactional, actor.scope);
      const { member, invitation } = await pendingMemberInReach(this.ports, transactional, actor, memberId);
      const now = clock.now();
      if (invitation !== undefined) await assertWithdrawAllowed(this.ports, transactional, actor, invitation.grant);
      // An invitation an accept found unusable is already revoked (D213): only the member is left to remove.
      if (invitation !== undefined && !FINAL_STATES.has(invitationStateOf(invitation, now))) {
        await invitations.update(transactional, actor.scope, invitation.id, { revokedAt: now });
      }
      await members.update(transactional, actor.scope, member.id, { removedAt: now, updatedAt: now });
      await recordMemberActivity(this.ports, transactional, {
        scope: actor.scope,
        actorAdministratorId: actor.administratorId,
        origin: actor,
        action: ACTIVITY_ACTIONS.INVITATION_REVOKED,
        summary: 'Invitation revoked',
        member,
      });
    });
  }
}
