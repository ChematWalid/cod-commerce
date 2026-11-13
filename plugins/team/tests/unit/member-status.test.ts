import { INVITATION_TTL_MS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { statusLabelOf, tabOf } from '../../domain/member-status';
import { invitedMember, openInvitation, scopeA, T0 } from '../support/builders';

describe('tabOf', () => {
  it.each([
    ['invited', 'pending'],
    ['active', 'active'],
    ['inactive', 'inactive'],
  ] as const)('lists a %s member under %s', (status, tab) => {
    // Arrange
    const member = invitedMember(scopeA, { status });

    // Act and assert
    expect(tabOf(member)).toBe(tab);
  });
});

describe('statusLabelOf', () => {
  it('keeps an invited member whose invitation expired under pending, marked expired', () => {
    // Arrange
    const member = invitedMember(scopeA);
    const invitation = openInvitation(member);

    // Act
    const label = statusLabelOf(member, invitation, new Date(T0.getTime() + INVITATION_TTL_MS));

    // Assert
    expect(label).toEqual({ tab: 'pending', invitationExpired: true });
  });

  it('does not mark an invited member with an open invitation as expired', () => {
    // Arrange
    const member = invitedMember(scopeA);

    // Act
    const label = statusLabelOf(member, openInvitation(member), T0);

    // Assert
    expect(label).toEqual({ tab: 'pending', invitationExpired: false });
  });

  it('never marks an active member as expired', () => {
    // Arrange
    const member = invitedMember(scopeA, { status: 'active' });

    // Act
    const label = statusLabelOf(member, undefined, T0);

    // Assert
    expect(label).toEqual({ tab: 'active', invitationExpired: false });
  });
});
