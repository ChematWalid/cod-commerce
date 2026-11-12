import { describe, expect, expectTypeOf, it } from 'vitest';
import { emailKeyOf, type TeamMemberView, toTeamMemberView } from '../../domain/team-member';
import { invitedMember, scopeA } from '../support/builders';

describe('emailKeyOf', () => {
  it('trims and lower-cases an address', () => {
    // Act and assert
    expect(emailKeyOf('  Foo@X.COM ')).toBe('foo@x.com');
  });
});

describe('TeamMemberView', () => {
  it('carries no token hash, no email key and no business id', () => {
    // Arrange
    const member = invitedMember(scopeA);

    // Act
    const view = toTeamMemberView(member);

    // Assert
    expect(Object.keys(view)).not.toEqual(expect.arrayContaining(['tokenHash']));
    expect(view).not.toHaveProperty('emailKey');
    expect(view).not.toHaveProperty('businessId');
    expectTypeOf<TeamMemberView>().not.toHaveProperty('tokenHash');
  });

  it('hides the salary unless the caller may see it (D207)', () => {
    // Arrange
    const member = invitedMember(scopeA, { baseSalary: 45_000 });

    // Act
    const byDefault = toTeamMemberView(member);
    const denied = toTeamMemberView(member, { canSeeSalary: false });
    const allowed = toTeamMemberView(member, { canSeeSalary: true });

    // Assert
    expect(byDefault.baseSalary).toBeNull();
    expect(denied.baseSalary).toBeNull();
    expect(allowed.baseSalary).toBe(45_000);
  });
});
