import { ACTIVITY_ACTIONS, INVITATION_TTL_MS, teamMemberActivityDiffSchema, toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { AcceptInvitationService } from '../../application/accept-invitation.service';
import { InviteMemberService } from '../../application/invite-member.service';
import { PreviewInvitationService } from '../../application/preview-invitation.service';
import { AccountElsewhereError, InvitationExpiredError, InvitationInvalidError } from '../../domain/errors';
import type { TeamMember } from '../../domain/team-member';
import { type InvitationWorld, invitationWorld, ownerOfA, RbacRefusal } from '../fakes/invitation-world';
import { invitedMember, openInvitation, scopeA, T0 } from '../support/builders';

const ACCEPT = { token: 'token-0', firstName: 'Nadia', lastName: 'Saidi', password: 'synthetic-member-password' };
const GRANT = { roleIds: [toSnowflake('900')], storeAccess: 'selected' as const, storeIds: [toSnowflake('11')] };
const ORIGIN = { ip: '198.51.100.7', userAgent: 'invitee' };

/** An invited member of A whose open invitation, sent by administrator 1, was mailed with `token-0`. */
function pending(world: InvitationWorld): TeamMember {
  const member = invitedMember(scopeA, { email: 'Nadia@Example.test', emailKey: 'nadia@example.test' });
  world.members.rows.push(member);
  world.invitations.rows.push(
    openInvitation(member, { tokenHash: world.ports.tokens.hash('token-0'), grant: GRANT, locale: 'en' }),
  );
  return member;
}

/** Nothing of the accept is kept: no account, no grant, the member never activated. */
function expectNoAccountKept(world: InvitationWorld): void {
  expect(world.accounts.created).toEqual([]);
  expect(world.accounts.verified).toEqual([]);
  expect(world.access.grants).toEqual([]);
  expect(world.members.rows[0]?.status).toBe('invited');
}

/** Nothing of the accept is left: no account, no grant, the member still invited, no activity row. */
function expectNothingKept(world: InvitationWorld): void {
  expectNoAccountKept(world);
  expect(world.activity.rows).toEqual([]);
}

describe('AcceptInvitationService', () => {
  it('claims the token, creates the account, marks it verified, grants as the inviter, then activates the member', async () => {
    // Arrange
    const world = invitationWorld();
    const member = pending(world);

    // Act
    const result = await new AcceptInvitationService(world.ports).accept(world.ctx, ACCEPT, ORIGIN);

    // Assert
    expect(result).toEqual({ businessId: scopeA.businessId });
    expect(world.log).toEqual([
      `lock:${scopeA.businessId}`,
      'assertEmailFree',
      'create',
      'markVerified',
      'setAccess',
      'flush',
    ]);
    const [account] = world.accounts.created;
    expect(account).toMatchObject({ email: 'Nadia@Example.test', firstName: 'Nadia', businessId: scopeA.businessId });
    expect(world.accounts.verified).toEqual([{ administratorId: account?.administratorId, locale: 'en' }]);
    expect(world.access.grants).toEqual([
      {
        administratorId: account?.administratorId,
        actor: { administratorId: 1, scope: scopeA, ...ORIGIN },
        grant: GRANT,
      },
    ]);
    expect(world.access.flushed).toEqual([[account?.administratorId]]);
    expect(world.members.rows[0]).toMatchObject({
      id: member.id,
      status: 'active',
      administratorId: account?.administratorId,
      firstName: 'Nadia',
      lastName: 'Saidi',
      joinedAt: T0,
    });
    expect(world.invitations.rows[0]?.acceptedAt).toEqual(T0);
  });

  it('writes one accepted row by the new administrator, naming the member but no address (D216)', async () => {
    // Arrange
    const world = invitationWorld();
    const member = pending(world);

    // Act
    await new AcceptInvitationService(world.ports).accept(world.ctx, ACCEPT, ORIGIN);

    // Assert
    const [row] = world.activity.rows;
    expect(row?.action).toBe(ACTIVITY_ACTIONS.INVITATION_ACCEPTED);
    expect(row?.actorAdministratorId).toBe(world.accounts.created[0]?.administratorId);
    expect(teamMemberActivityDiffSchema.parse(row?.diff)).toEqual({
      memberId: member.id,
      displayName: 'Nadia Saidi',
      changedFields: ['status'],
    });
  });

  it('refuses a token that opens nothing before it takes any lock or creates anything', async () => {
    // Arrange
    const world = invitationWorld();
    pending(world);

    // Act
    const accepting = new AcceptInvitationService(world.ports).accept(world.ctx, { ...ACCEPT, token: 'guessed' });

    // Assert
    await expect(accepting).rejects.toBeInstanceOf(InvitationInvalidError);
    expect(world.log).toEqual([]);
  });

  it('accepts a token once: a second accept is refused with the opaque code', async () => {
    // Arrange
    const world = invitationWorld();
    pending(world);
    const service = new AcceptInvitationService(world.ports);
    await service.accept(world.ctx, ACCEPT);

    // Act
    const again = service.accept(world.ctx, ACCEPT);

    // Assert
    await expect(again).rejects.toBeInstanceOf(InvitationInvalidError);
    expect(world.accounts.created).toHaveLength(1);
  });

  it('refuses an expired invitation with its own code, creating nothing', async () => {
    // Arrange
    const world = invitationWorld();
    pending(world);
    world.clock.now = new Date(T0.getTime() + INVITATION_TTL_MS);

    // Act
    const accepting = new AcceptInvitationService(world.ports).accept(world.ctx, ACCEPT);

    // Assert
    await expect(accepting).rejects.toBeInstanceOf(InvitationExpiredError);
    expect(world.log).not.toContain('create');
    expectNothingKept(world);
  });

  it('refuses an address that already has an account, never marks it verified, and leaves the token open', async () => {
    // Arrange
    const world = invitationWorld();
    pending(world);
    world.accounts.taken.add('nadia@example.test');

    // Act
    const accepting = new AcceptInvitationService(world.ports).accept(world.ctx, ACCEPT);

    // Assert
    await expect(accepting).rejects.toBeInstanceOf(AccountElsewhereError);
    expect(world.log).not.toContain('markVerified');
    expectNothingKept(world);
    expect(world.invitations.rows[0]).toMatchObject({ acceptedAt: null, revokedAt: null });
  });

  it.each([
    ['an inviter who lost the privilege', 'rbac.privilege-exceeded'],
    ['an inviter who was removed', 'rbac.member-not-found'],
    ['a role deleted since', 'rbac.role-not-found'],
    ['a store archived since', 'rbac.store-access-invalid'],
  ])('refuses %s with the one opaque code, keeps no account and revokes the invitation', async (_case, code) => {
    // Arrange
    const world = invitationWorld();
    pending(world);
    world.access.setAccessRefusal = new RbacRefusal(code);

    // Act
    const accepting = new AcceptInvitationService(world.ports).accept(world.ctx, ACCEPT);

    // Assert
    await expect(accepting).rejects.toBeInstanceOf(InvitationInvalidError);
    expectNoAccountKept(world);
    expect(world.invitations.rows[0]).toMatchObject({ acceptedAt: null, revokedAt: T0 });
    expect(world.access.flushed).toEqual([]);
  });

  it('removes the member of an unusable invitation, by no actor, so its address can be invited again', async () => {
    // Arrange
    const world = invitationWorld();
    const member = pending(world);
    world.access.setAccessRefusal = new RbacRefusal('rbac.member-not-found');
    await expect(new AcceptInvitationService(world.ports).accept(world.ctx, ACCEPT)).rejects.toBeInstanceOf(
      InvitationInvalidError,
    );
    world.access.setAccessRefusal = undefined;

    // Act
    await new InviteMemberService(world.ports).invite(world.ctx, ownerOfA, {
      email: 'nadia@example.test',
      roleIds: GRANT.roleIds,
      storeAccess: 'selected',
      storeIds: GRANT.storeIds,
      baseSalary: 0,
      commissionConfigIds: [],
      locale: 'en',
    });

    // Assert
    expect(world.members.rows[0]).toMatchObject({ id: member.id, removedAt: T0, updatedAt: T0 });
    const [revoked] = world.activity.rows;
    expect(revoked?.action).toBe(ACTIVITY_ACTIONS.INVITATION_REVOKED);
    expect(revoked?.actorAdministratorId).toBeNull();
    expect(teamMemberActivityDiffSchema.parse(revoked?.diff)).toMatchObject({ memberId: member.id });
    expect(world.members.rows.filter((row) => row.removedAt === null)).toHaveLength(1);
  });

  it('lets an unexpected failure through unchanged, keeping nothing', async () => {
    // Arrange
    const world = invitationWorld();
    pending(world);
    const outage = new Error('connection lost');
    world.access.setAccessRefusal = outage;

    // Act
    const accepting = new AcceptInvitationService(world.ports).accept(world.ctx, ACCEPT);

    // Assert
    await expect(accepting).rejects.toBe(outage);
    expectNothingKept(world);
    expect(world.invitations.rows[0]).toMatchObject({ acceptedAt: null, revokedAt: null });
  });
});

describe('PreviewInvitationService', () => {
  it('shows the invited address, the business and the inviter of an open invitation', async () => {
    // Arrange
    const world = invitationWorld();
    pending(world);

    // Act
    const preview = await new PreviewInvitationService(world.ports).preview(world.ctx, 'token-0');

    // Assert
    expect(preview).toEqual({
      email: 'Nadia@Example.test',
      businessName: 'Atlas SARL',
      inviterName: 'Amina Owner',
      expiresAt: new Date(T0.getTime() + INVITATION_TTL_MS),
    });
  });

  it('answers the same opaque refusal for an unknown, a revoked and an expired token', async () => {
    // Arrange
    const world = invitationWorld();
    pending(world);
    const service = new PreviewInvitationService(world.ports);
    const revoked = invitedMember(scopeA);
    world.members.rows.push(revoked);
    world.invitations.rows.push(
      openInvitation(revoked, { tokenHash: world.ports.tokens.hash('token-r'), revokedAt: T0 }),
    );

    // Act
    const unknown = service.preview(world.ctx, 'guessed');
    const ofRevoked = service.preview(world.ctx, 'token-r');
    world.clock.now = new Date(T0.getTime() + INVITATION_TTL_MS);
    const expired = service.preview(world.ctx, 'token-0');

    // Assert
    for (const refusal of [unknown, ofRevoked, expired]) {
      await expect(refusal).rejects.toBeInstanceOf(InvitationInvalidError);
    }
  });
});
