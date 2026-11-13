import { ACTIVITY_ACTIONS, MAX_PENDING_INVITATIONS, type Snowflake } from '@cod/shared';
import { MemberNotPendingError, TooManyPendingError } from '../domain/errors';
import { assertResendAllowed, type Invitation, invitationStateOf, nextExpiry } from '../domain/invitation';
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
   * @throws a rbac `DomainError` for an invitation grant the actor could not make itself (D60), before any cap, so
   *   such an actor learns nothing of the invitation's resend state (D803).
   * @throws {ResendLimitError} or {ResendCooldownError} under the abuse caps (D205).
   * @throws {TooManyPendingError} for an expired invitation while the business holds
   *   {@link MAX_PENDING_INVITATIONS} open ones: a resend reopens it (D803).
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
    // The accept runs as the original inviter, so a fresh link must not let a lesser actor re-arm a grant (D60).
    await assertGrantAllowed(this.ports, ctx, actor, invitation.grant);
    assertResendAllowed(invitation, now);
    await this.assertRoomToReopen(ctx, actor, invitation, now);
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

  /** An expired invitation becomes open again, so it counts toward the pending cap; an open one is already counted. */
  private async assertRoomToReopen(
    ctx: OperationContext,
    actor: TeamActor,
    invitation: Invitation,
    now: Date,
  ): Promise<void> {
    if (invitationStateOf(invitation, now) === 'open') return;
    if ((await this.ports.invitations.countOpen(ctx, actor.scope, now)) >= MAX_PENDING_INVITATIONS) {
      throw new TooManyPendingError();
    }
  }
}
