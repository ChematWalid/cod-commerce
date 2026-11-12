import {
  ACTIVITY_ACTIONS,
  INVITATION_MAX_RESENDS,
  INVITATION_RESEND_COOLDOWN_MS,
  INVITATION_TTL_MS,
  toSnowflake,
} from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { AcceptInvitationService } from '../../application/accept-invitation.service';
import { ResendInvitationService } from '../../application/resend-invitation.service';
import { RevokeInvitationService } from '../../application/revoke-invitation.service';
import {
  InvitationInvalidError,
  MemberNotFoundError,
  MemberNotPendingError,
  ResendCooldownError,
  ResendLimitError,
} from '../../domain/errors';
import type { TeamMember } from '../../domain/team-member';
import { type InvitationWorld, invitationWorld, ownerOfA } from '../fakes/invitation-world';
import { invitedMember, openInvitation, scopeA, scopeB, T0 } from '../support/builders';

const ACCEPT = { firstName: 'Nadia', lastName: 'Saidi', password: 'synthetic-member-password' };
const AFTER_COOLDOWN = new Date(T0.getTime() + INVITATION_RESEND_COOLDOWN_MS);

/** An invited member of `scope` whose open invitation was mailed with `token-0` at T0, on store 11 only. */
function pendingMember(world: InvitationWorld, scope = scopeA, overrides: Partial<TeamMember> = {}): TeamMember {
  const member = invitedMember(scope, overrides);
  world.members.rows.push(member);
  world.invitations.rows.push(
    openInvitation(member, {
      tokenHash: world.ports.tokens.hash('token-0'),
      grant: { roleIds: [toSnowflake('900')], storeAccess: 'selected', storeIds: [toSnowflake('11')] },
    }),
  );
  return member;
}

describe('ResendInvitationService', () => {
  it('mails a new token with a new expiry, and the previous token no longer opens the invitation', async () => {
    // Arrange
    const world = invitationWorld();
    const member = pendingMember(world);
    world.clock.now = AFTER_COOLDOWN;

    // Act
    await new ResendInvitationService(world.ports).resend(world.ctx, ownerOfA, member.id);
    const oldLink = new AcceptInvitationService(world.ports).accept(world.ctx, { token: 'token-0', ...ACCEPT });

    // Assert
    expect(world.mail.sent.map((mail) => mail.token)).toEqual(['token-1']);
    expect(world.invitations.rows[0]).toMatchObject({
      tokenHash: world.ports.tokens.hash('token-1'),
      lastSentAt: AFTER_COOLDOWN,
      expiresAt: new Date(AFTER_COOLDOWN.getTime() + INVITATION_TTL_MS),
      resendCount: 1,
    });
    await expect(oldLink).rejects.toBeInstanceOf(InvitationInvalidError);
    expect(world.activity.rows.map((row) => row.action)).toEqual([ACTIVITY_ACTIONS.INVITATION_RESENT]);
  });

  it('refuses a resend inside the cooldown, so a double click sends one mail', async () => {
    // Arrange
    const world = invitationWorld();
    const member = pendingMember(world);
    world.clock.now = AFTER_COOLDOWN;
    const service = new ResendInvitationService(world.ports);
    await service.resend(world.ctx, ownerOfA, member.id);

    // Act
    const again = service.resend(world.ctx, ownerOfA, member.id);

    // Assert
    await expect(again).rejects.toBeInstanceOf(ResendCooldownError);
    expect(world.mail.sent).toHaveLength(1);
  });

  it('refuses a resend once the invitation was resent as often as allowed', async () => {
    // Arrange
    const world = invitationWorld();
    const member = pendingMember(world);
    world.invitations.rows = world.invitations.rows.map((row) => ({ ...row, resendCount: INVITATION_MAX_RESENDS }));
    world.clock.now = AFTER_COOLDOWN;

    // Act
    const resending = new ResendInvitationService(world.ports).resend(world.ctx, ownerOfA, member.id);

    // Assert
    await expect(resending).rejects.toBeInstanceOf(ResendLimitError);
    expect(world.mail.sent).toEqual([]);
  });

  it('resends an expired invitation, which still lists as pending', async () => {
    // Arrange
    const world = invitationWorld();
    const member = pendingMember(world);
    world.clock.now = new Date(T0.getTime() + INVITATION_TTL_MS + 1);

    // Act
    await new ResendInvitationService(world.ports).resend(world.ctx, ownerOfA, member.id);

    // Assert
    expect(world.mail.sent).toHaveLength(1);
  });

  it("answers not found for another business's member and for one outside a store-limited actor's reach", async () => {
    // Arrange
    const world = invitationWorld();
    const ofB = pendingMember(world, scopeB);
    const onStore11 = pendingMember(world);
    world.clock.now = AFTER_COOLDOWN;
    const service = new ResendInvitationService(world.ports);

    // Act
    const crossBusiness = service.resend(world.ctx, ownerOfA, ofB.id);
    world.access.reach = { allStores: false, storeIds: [toSnowflake('12')] };
    const outOfReach = service.resend(world.ctx, ownerOfA, onStore11.id);

    // Assert
    await expect(crossBusiness).rejects.toBeInstanceOf(MemberNotFoundError);
    await expect(outOfReach).rejects.toBeInstanceOf(MemberNotFoundError);
    expect(world.mail.sent).toEqual([]);
  });

  it('refuses a member that is no longer invited', async () => {
    // Arrange
    const world = invitationWorld();
    const member = pendingMember(world, scopeA, { status: 'active', administratorId: 77 });
    world.clock.now = AFTER_COOLDOWN;

    // Act
    const resending = new ResendInvitationService(world.ports).resend(world.ctx, ownerOfA, member.id);

    // Assert
    await expect(resending).rejects.toBeInstanceOf(MemberNotPendingError);
  });
});

describe('RevokeInvitationService', () => {
  it('revokes the invitation, removes the member so its address can be invited again, and the link stops working', async () => {
    // Arrange
    const world = invitationWorld();
    const member = pendingMember(world);
    world.clock.now = AFTER_COOLDOWN;

    // Act
    await new RevokeInvitationService(world.ports).revoke(world.ctx, ownerOfA, member.id);
    const accepting = new AcceptInvitationService(world.ports).accept(world.ctx, { token: 'token-0', ...ACCEPT });

    // Assert
    expect(world.invitations.rows[0]?.revokedAt).toEqual(AFTER_COOLDOWN);
    expect(world.members.rows[0]?.removedAt).toEqual(AFTER_COOLDOWN);
    await expect(world.members.findLiveByEmailKey(world.ctx, scopeA, member.emailKey)).resolves.toBeUndefined();
    await expect(accepting).rejects.toBeInstanceOf(InvitationInvalidError);
    expect(world.accounts.created).toEqual([]);
    expect(world.activity.rows.map((row) => row.action)).toEqual([ACTIVITY_ACTIONS.INVITATION_REVOKED]);
  });

  it("answers not found for another business's member", async () => {
    // Arrange
    const world = invitationWorld();
    const ofB = pendingMember(world, scopeB);

    // Act
    const revoking = new RevokeInvitationService(world.ports).revoke(world.ctx, ownerOfA, ofB.id);

    // Assert
    await expect(revoking).rejects.toBeInstanceOf(MemberNotFoundError);
    expect(world.invitations.rows[0]?.revokedAt).toBeNull();
  });
});
