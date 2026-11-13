import {
  INVITATION_MAX_RESENDS,
  INVITATION_RESEND_COOLDOWN_MS,
  INVITATION_TTL_MS,
  MAX_PENDING_INVITATIONS,
  RBAC_ERROR_CODES,
  type TenantScope,
  toSnowflake,
} from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ResendInvitationService } from '../../application/resend-invitation.service';
import { TooManyPendingError } from '../../domain/errors';
import type { TeamMember } from '../../domain/team-member';
import { type InvitationWorld, invitationWorld, ownerOfA, RbacRefusal } from '../fakes/invitation-world';
import { invitedMember, openInvitation, scopeA, scopeB, T0 } from '../support/builders';

const AFTER_COOLDOWN = new Date(T0.getTime() + INVITATION_RESEND_COOLDOWN_MS);
const AFTER_EXPIRY = new Date(T0.getTime() + INVITATION_TTL_MS + 1);

/** An invited member of A whose open invitation was mailed with `token-0` at T0, on store 11 only. */
function pendingMember(world: InvitationWorld): TeamMember {
  const member = invitedMember(scopeA);
  world.members.rows.push(member);
  world.invitations.rows.push(
    openInvitation(member, {
      tokenHash: world.ports.tokens.hash('token-0'),
      grant: { roleIds: [toSnowflake('900')], storeAccess: 'selected', storeIds: [toSnowflake('11')] },
    }),
  );
  return member;
}

/** Fills `scope` with {@link MAX_PENDING_INVITATIONS} invitations still open at `now`. */
function fillToTheCap(world: InvitationWorld, scope: TenantScope, now: Date): void {
  for (let index = 0; index < MAX_PENDING_INVITATIONS; index += 1) {
    const member = invitedMember(scope);
    world.members.rows.push(member);
    world.invitations.rows.push(
      openInvitation(member, { lastSentAt: now, expiresAt: new Date(now.getTime() + INVITATION_TTL_MS) }),
    );
  }
}

describe('ResendInvitationService caps and their order (D803)', () => {
  it('refuses to reopen an expired invitation once the business holds the most open invitations, and mails nothing', async () => {
    // Arrange
    const world = invitationWorld();
    const member = pendingMember(world);
    world.clock.now = AFTER_EXPIRY;
    fillToTheCap(world, scopeA, AFTER_EXPIRY);

    // Act
    const resending = new ResendInvitationService(world.ports).resend(world.ctx, ownerOfA, member.id);

    // Assert
    await expect(resending).rejects.toBeInstanceOf(TooManyPendingError);
    expect(world.mail.sent).toEqual([]);
    expect(world.invitations.rows[0]).toMatchObject({ tokenHash: world.ports.tokens.hash('token-0'), resendCount: 0 });
    expect(world.activity.rows).toEqual([]);
  });

  it('resends an open invitation at the cap, which opens nothing new', async () => {
    // Arrange
    const world = invitationWorld();
    const member = pendingMember(world);
    world.clock.now = AFTER_COOLDOWN;
    fillToTheCap(world, scopeA, AFTER_COOLDOWN);

    // Act
    await new ResendInvitationService(world.ports).resend(world.ctx, ownerOfA, member.id);

    // Assert
    expect(world.mail.sent).toHaveLength(1);
  });

  it("reopens an expired invitation of A while B holds the most open invitations: B's count is not A's", async () => {
    // Arrange
    const world = invitationWorld();
    const member = pendingMember(world);
    world.clock.now = AFTER_EXPIRY;
    fillToTheCap(world, scopeB, AFTER_EXPIRY);

    // Act
    await new ResendInvitationService(world.ports).resend(world.ctx, ownerOfA, member.id);

    // Assert
    expect(world.mail.sent).toHaveLength(1);
  });

  it.each([
    ['inside the cooldown', T0, 0],
    ['past the resend limit', AFTER_COOLDOWN, INVITATION_MAX_RESENDS],
  ])(
    "answers an actor who could not make the grant with rbac's refusal, not the cap it hit %s",
    async (_case, now, resendCount) => {
      // Arrange
      const world = invitationWorld();
      const member = pendingMember(world);
      world.invitations.rows = world.invitations.rows.map((row) => ({ ...row, resendCount }));
      world.clock.now = now;
      const refusal = new RbacRefusal(RBAC_ERROR_CODES.OWNER_RESTRICTED);
      world.access.previewRefusal = refusal;

      // Act
      const resending = new ResendInvitationService(world.ports).resend(world.ctx, ownerOfA, member.id);

      // Assert
      await expect(resending).rejects.toBe(refusal);
      expect(world.mail.sent).toEqual([]);
    },
  );

  it("answers an actor who could not make the grant with rbac's refusal, not the pending cap", async () => {
    // Arrange
    const world = invitationWorld();
    const member = pendingMember(world);
    world.clock.now = AFTER_EXPIRY;
    fillToTheCap(world, scopeA, AFTER_EXPIRY);
    const refusal = new RbacRefusal(RBAC_ERROR_CODES.OWNER_RESTRICTED);
    world.access.previewRefusal = refusal;

    // Act
    const resending = new ResendInvitationService(world.ports).resend(world.ctx, ownerOfA, member.id);

    // Assert
    await expect(resending).rejects.toBe(refusal);
  });
});
