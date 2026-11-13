import { INVITATION_MAX_RESENDS, INVITATION_RESEND_COOLDOWN_MS, INVITATION_TTL_MS } from '@cod/shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { ResendCooldownError, ResendLimitError } from '../../domain/errors';
import {
  assertResendAllowed,
  invitationStateOf,
  type InvitationView,
  nextExpiry,
  toInvitationView,
} from '../../domain/invitation';
import { invitedMember, openInvitation, scopeA, T0 } from '../support/builders';

const at = (offsetMs: number): Date => new Date(T0.getTime() + offsetMs);

describe('invitationStateOf', () => {
  it('is open before the expiry', () => {
    // Arrange
    const invitation = openInvitation(invitedMember(scopeA));

    // Act
    const state = invitationStateOf(invitation, at(INVITATION_TTL_MS - 1));

    // Assert
    expect(state).toBe('open');
  });

  it('is expired at exactly expiresAt', () => {
    // Arrange
    const invitation = openInvitation(invitedMember(scopeA));

    // Act
    const state = invitationStateOf(invitation, invitation.expiresAt);

    // Assert
    expect(state).toBe('expired');
  });

  it('is revoked once revoked, even after the expiry', () => {
    // Arrange
    const invitation = openInvitation(invitedMember(scopeA), { revokedAt: at(1000) });

    // Act
    const state = invitationStateOf(invitation, at(INVITATION_TTL_MS * 2));

    // Assert
    expect(state).toBe('revoked');
  });

  it('is accepted once accepted, even after the expiry', () => {
    // Arrange
    const invitation = openInvitation(invitedMember(scopeA), { acceptedAt: at(1000) });

    // Act
    const state = invitationStateOf(invitation, at(INVITATION_TTL_MS * 2));

    // Assert
    expect(state).toBe('accepted');
  });
});

describe('assertResendAllowed', () => {
  it('refuses a resend inside the cooldown', () => {
    // Arrange
    const invitation = openInvitation(invitedMember(scopeA));

    // Act and assert
    expect(() => {
      assertResendAllowed(invitation, at(INVITATION_RESEND_COOLDOWN_MS - 1));
    }).toThrow(ResendCooldownError);
  });

  it('allows a resend once the cooldown has passed', () => {
    // Arrange
    const invitation = openInvitation(invitedMember(scopeA));

    // Act and assert
    expect(() => {
      assertResendAllowed(invitation, at(INVITATION_RESEND_COOLDOWN_MS));
    }).not.toThrow();
  });

  it('refuses a resend past the resend cap, whatever the time', () => {
    // Arrange
    const invitation = openInvitation(invitedMember(scopeA), { resendCount: INVITATION_MAX_RESENDS });

    // Act and assert
    expect(() => {
      assertResendAllowed(invitation, at(INVITATION_TTL_MS - 1));
    }).toThrow(ResendLimitError);
  });
});

describe('nextExpiry', () => {
  it('is the invitation lifetime after now', () => {
    // Act
    const expiry = nextExpiry(T0);

    // Assert
    expect(expiry.getTime() - T0.getTime()).toBe(INVITATION_TTL_MS);
  });
});

describe('InvitationView', () => {
  it('never carries the token hash, even from an issued invitation', () => {
    // Arrange
    const issued = openInvitation(invitedMember(scopeA));

    // Act
    const view = toInvitationView(issued, T0);

    // Assert
    expect(Object.keys(view)).not.toContain('tokenHash');
    expect(JSON.stringify(view)).not.toContain(issued.tokenHash);
    expectTypeOf<InvitationView>().not.toHaveProperty('tokenHash');
  });

  it('tells the state of the invitation', () => {
    // Arrange
    const issued = openInvitation(invitedMember(scopeA));

    // Act
    const view = toInvitationView(issued, issued.expiresAt);

    // Assert
    expect(view.state).toBe('expired');
  });
});
