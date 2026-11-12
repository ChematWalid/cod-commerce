import { ACTIVITY_ACTIONS, type Snowflake } from '@cod/shared';
import { MemberNotPendingError } from '../domain/errors';
import { assertResendAllowed, invitationStateOf, nextExpiry } from '../domain/invitation';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TeamActor } from '../domain/team-actor';
import {
  type TeamMember,
  type TeamMemberView,
  type TeamMemberViewOptions,
  toTeamMemberView,
} from '../domain/team-member';
import type { TeamInvitationPorts } from './invitation-ports';
import { assertGrantAllowed, mailInvitation, pendingMemberInReach, recordMemberActivity } from './invitation-guards';

const RESENDABLE = new Set(['open', 'expired']);

/** Mails a pending member a fresh link; the previous link stops working (D205). */
export class ResendInvitationService {
  constructor(private readonly ports: TeamInvitationPorts) {}

  /**
   * Replaces the token (its hash), restarts the lifetime and mails the new link after commit.
   *
   * @throws {MemberNotFoundError} for no such member or one out of the actor's reach (D211).
   * @throws {MemberNotPendingError} for a member not invited, or whose invitation was accepted or revoked.
   * @throws {ResendLimitError} or {ResendCooldownError} under the abuse caps (D205).
   * @throws a rbac `DomainError` for an invitation grant the actor could not make itself (D60).
   */
  async resend(
    ctx: OperationContext,
    actor: TeamActor,
    memberId: Snowflake,
    view: TeamMemberViewOptions = {},
  ): Promise<TeamMemberView> {
    const member = await this.ports.transaction.run(ctx, actor.scope, (transactional) =>
      this.resendIn(transactional, actor, memberId),
    );
    return toTeamMemberView(member, view);
  }

  private async resendIn(ctx: OperationContext, actor: TeamActor, memberId: Snowflake): Promise<TeamMember> {
    const { lock, invitations, clock, tokens } = this.ports;
    await lock.acquire(ctx, actor.scope);
    const { member, invitation } = await pendingMemberInReach(this.ports, ctx, actor, memberId);
    const now = clock.now();
    if (invitation === undefined || !RESENDABLE.has(invitationStateOf(invitation, now))) {
      throw new MemberNotPendingError();
    }
    assertResendAllowed(invitation, now);
    // The accept runs as the original inviter, so a fresh link must not let a lesser actor re-arm a grant (D60).
    await assertGrantAllowed(this.ports, ctx, actor, invitation.grant);
    const token = tokens.newToken();
    await invitations.update(ctx, actor.scope, invitation.id, {
      tokenHash: tokens.hash(token),
      expiresAt: nextExpiry(now),
      lastSentAt: now,
      resendCount: invitation.resendCount + 1,
    });
    await recordMemberActivity(this.ports, ctx, {
      scope: actor.scope,
      actorAdministratorId: actor.administratorId,
      origin: actor,
      action: ACTIVITY_ACTIONS.INVITATION_RESENT,
      summary: 'Invitation resent',
      member,
    });
    await mailInvitation(this.ports, ctx, { member, invitation, token });
    return member;
  }
}
