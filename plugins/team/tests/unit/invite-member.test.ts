import {
  ACTIVITY_ACTIONS,
  type InviteMemberCommand,
  MAX_PENDING_INVITATIONS,
  teamMemberActivityDiffSchema,
  toSnowflake,
} from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InviteMemberService } from '../../application/invite-member.service';
import {
  CommissionNotFoundError,
  EmailAlreadyMemberError,
  InvalidInputError,
  TooManyPendingError,
} from '../../domain/errors';
import { invitationWorld, ownerOfA, RbacRefusal } from '../fakes/invitation-world';
import { invitedMember, openInvitation, scopeA, scopeB } from '../support/builders';

const ROLE = toSnowflake('900');
const STORE_1 = toSnowflake('11');

function command(overrides: Partial<InviteMemberCommand> = {}): InviteMemberCommand {
  return {
    email: 'nadia@example.test',
    roleIds: [ROLE],
    storeAccess: 'selected',
    storeIds: [STORE_1],
    baseSalary: 45_000,
    commissionConfigIds: [],
    locale: 'en',
    ...overrides,
  };
}

describe('InviteMemberService', () => {
  it('stores an invited member and an invitation holding only the hash of the mailed token', async () => {
    // Arrange
    const world = invitationWorld();
    const service = new InviteMemberService(world.ports);

    // Act
    const view = await service.invite(world.ctx, ownerOfA, command());

    // Assert
    const [member] = world.members.rows;
    const [invitation] = world.invitations.rows;
    const [mail] = world.mail.sent;
    expect(member).toMatchObject({ status: 'invited', emailKey: 'nadia@example.test', baseSalary: 45_000 });
    expect(invitation).toMatchObject({
      memberId: member?.id,
      grant: { roleIds: [ROLE], storeAccess: 'selected', storeIds: [STORE_1] },
      tokenHash: world.ports.tokens.hash('token-1'),
      invitedByAdministratorId: 1,
      locale: 'en',
    });
    expect(JSON.stringify([world.members.rows, world.invitations.rows])).not.toContain('"token-1"');
    expect(mail).toEqual({
      to: 'nadia@example.test',
      locale: 'en',
      token: 'token-1',
      inviterName: 'Amina Owner',
      businessName: 'Atlas SARL',
    });
    expect(view).not.toHaveProperty('tokenHash');
    expect(JSON.stringify(view)).not.toContain('token-1');
  });

  it('takes the business lock, then judges the grant with rbac before it stores anything', async () => {
    // Arrange
    const world = invitationWorld();

    // Act
    await new InviteMemberService(world.ports).invite(world.ctx, ownerOfA, command());

    // Assert
    expect(world.log).toEqual([`lock:${scopeA.businessId}`, 'preview']);
  });

  it('writes one activity row naming no salary, email or token (D216)', async () => {
    // Arrange
    const world = invitationWorld();

    // Act
    await new InviteMemberService(world.ports).invite(world.ctx, ownerOfA, command());

    // Assert
    const [row] = world.activity.rows;
    expect(row?.action).toBe(ACTIVITY_ACTIONS.MEMBER_INVITED);
    expect(teamMemberActivityDiffSchema.parse(row?.diff)).toEqual({
      memberId: world.members.rows[0]?.id,
      displayName: null,
      changedFields: [],
    });
    expect(JSON.stringify(row)).not.toMatch(/45000|nadia@|token-1/);
  });

  it('refuses an address a live member of the business already has, whatever its case and spaces', async () => {
    // Arrange
    const world = invitationWorld();
    world.members.rows.push(invitedMember(scopeA, { email: 'Nadia@Example.test', emailKey: 'nadia@example.test' }));

    // Act
    const inviting = new InviteMemberService(world.ports).invite(
      world.ctx,
      ownerOfA,
      command({ email: '  NADIA@example.TEST ' }),
    );

    // Assert
    await expect(inviting).rejects.toBeInstanceOf(EmailAlreadyMemberError);
    expect(world.invitations.rows).toEqual([]);
    expect(world.mail.sent).toEqual([]);
  });

  it('invites an address that is a member of another business only', async () => {
    // Arrange
    const world = invitationWorld();
    world.members.rows.push(invitedMember(scopeB, { email: 'nadia@example.test', emailKey: 'nadia@example.test' }));

    // Act
    await new InviteMemberService(world.ports).invite(world.ctx, ownerOfA, command());

    // Assert
    expect(world.members.rows.filter((row) => row.businessId === scopeA.businessId)).toHaveLength(1);
  });

  it('refuses a new invitation once the business holds the most open ones allowed', async () => {
    // Arrange
    const world = invitationWorld();
    for (let index = 0; index < MAX_PENDING_INVITATIONS; index += 1) {
      const member = invitedMember(scopeA);
      world.members.rows.push(member);
      world.invitations.rows.push(openInvitation(member, { tokenHash: `pending-${String(index)}`.padEnd(64, '0') }));
    }

    // Act
    const inviting = new InviteMemberService(world.ports).invite(world.ctx, ownerOfA, command());

    // Assert
    await expect(inviting).rejects.toBeInstanceOf(TooManyPendingError);
    expect(world.mail.sent).toEqual([]);
  });

  it('passes a refusal of the grant by rbac through, and stores and mails nothing', async () => {
    // Arrange
    const world = invitationWorld();
    world.access.previewRefusal = new RbacRefusal('rbac.privilege-exceeded');

    // Act
    const inviting = new InviteMemberService(world.ports).invite(world.ctx, ownerOfA, command());

    // Assert
    await expect(inviting).rejects.toMatchObject({ code: 'rbac.privilege-exceeded' });
    expect([world.members.rows, world.invitations.rows, world.mail.sent, world.activity.rows]).toEqual([
      [],
      [],
      [],
      [],
    ]);
  });

  it('refuses a grant outside the reach of a store-limited actor even when rbac would allow it (D211)', async () => {
    // Arrange
    const world = invitationWorld();
    world.access.reach = { allStores: false, storeIds: [STORE_1] };

    // Act
    const inviting = new InviteMemberService(world.ports).invite(
      world.ctx,
      ownerOfA,
      command({ storeIds: [toSnowflake('12')] }),
    );

    // Assert
    await expect(inviting).rejects.toBeInstanceOf(InvalidInputError);
    expect(world.members.rows).toEqual([]);
  });

  it('refuses a commission config the business does not have', async () => {
    // Arrange
    const world = invitationWorld();

    // Act
    const inviting = new InviteMemberService(world.ports).invite(
      world.ctx,
      ownerOfA,
      command({ commissionConfigIds: [toSnowflake('424242')] }),
    );

    // Assert
    await expect(inviting).rejects.toBeInstanceOf(CommissionNotFoundError);
    expect(world.members.rows).toEqual([]);
  });

  it('shows the salary only to a caller allowed to see it (D207)', async () => {
    // Arrange
    const world = invitationWorld();
    const service = new InviteMemberService(world.ports);

    // Act
    const hidden = await service.invite(world.ctx, ownerOfA, command());
    const shown = await service.invite(world.ctx, ownerOfA, command({ email: 'omar@example.test' }), {
      canSeeSalary: true,
    });

    // Assert
    expect([hidden.baseSalary, shown.baseSalary]).toEqual([null, 45_000]);
  });
});
