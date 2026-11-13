import { ACTIVITY_ACTIONS, RBAC_ERROR_CODES, TEAM_ERROR_CODES, toSnowflake } from '@cod/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoveMemberService } from '../../application/remove-member.service';
import type { RevokeInvitationService } from '../../application/revoke-invitation.service';
import { RbacRefusal } from '../fakes/invitation-world';
import {
  activeMember,
  inactiveMember,
  managerOfA,
  type MemberActionWorld,
  memberActionWorld,
  OWNER_ID,
  OWNER_ROLE,
  pendingMember,
} from '../fakes/member-action-world';

const MEMBER = 30;
const DELETED_ROLE = toSnowflake('9999');
let world: MemberActionWorld;
let revoke: ReturnType<typeof vi.fn<RevokeInvitationService['revoke']>>;
let service: RemoveMemberService;

beforeEach(() => {
  world = memberActionWorld();
  revoke = vi.fn<RevokeInvitationService['revoke']>(() => Promise.resolve());
  service = new RemoveMemberService(world.ports, { revoke });
});

describe('RemoveMemberService.remove', () => {
  it('clears the access, soft-deletes the account and frees the address, then signs the member out', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);

    // Act
    await service.remove(world.ctx, managerOfA, member.id);

    // Assert
    expect(world.access.held.has(MEMBER)).toBe(false);
    expect(world.accounts.softDeleted).toEqual([MEMBER]);
    expect(world.members.rows[0]?.removedAt).not.toBeNull();
    expect(world.log.indexOf('setAccess')).toBeLessThan(world.log.indexOf('softDelete'));
    expect(world.access.flushed).toEqual([[MEMBER]]);
    expect(world.activity.rows.map((row) => row.action)).toEqual([ACTIVITY_ACTIONS.MEMBER_REMOVED]);
  });

  it('removes a deactivated member once rbac judged its former grant (D60)', async () => {
    // Arrange
    const member = await inactiveMember(world, MEMBER);

    // Act
    await service.remove(world.ctx, managerOfA, member.id);

    // Assert
    expect(world.log).not.toContain('setAccess');
    expect(world.log.indexOf('assertMayChangeHolder')).toBeLessThan(world.log.indexOf('softDelete'));
    expect(world.accounts.softDeleted).toEqual([MEMBER]);
    expect(world.members.rows[0]).toMatchObject({ suspendedAccess: null });
  });

  it.each([RBAC_ERROR_CODES.OWNER_RESTRICTED, RBAC_ERROR_CODES.PRIVILEGE_EXCEEDED])(
    'refuses a deactivated member whose former grant the actor could not make (%s)',
    async (code) => {
      // Arrange
      const member = await inactiveMember(world, MEMBER, { roleIds: [OWNER_ROLE], storeAccess: 'all', storeIds: [] });
      world.access.holderRefusal = new RbacRefusal(code);

      // Act
      const change = service.remove(world.ctx, managerOfA, member.id);

      // Assert
      await expect(change).rejects.toMatchObject({ code });
      expect(world.accounts.softDeleted).toEqual([]);
      expect(world.members.rows[0]).toMatchObject({ removedAt: null, status: 'inactive' });
    },
  );

  it('refuses a deactivated co-owner whose snapshot also names a role deleted since (D60.7)', async () => {
    // Arrange
    const member = await inactiveMember(world, MEMBER, {
      roleIds: [OWNER_ROLE, DELETED_ROLE],
      storeAccess: 'all',
      storeIds: [],
    });
    world.access.previewRefusal = new RbacRefusal(RBAC_ERROR_CODES.ROLE_NOT_FOUND);
    world.access.holderRefusal = new RbacRefusal(RBAC_ERROR_CODES.OWNER_RESTRICTED);

    // Act
    const change = service.remove(world.ctx, managerOfA, member.id);

    // Assert
    await expect(change).rejects.toMatchObject({ code: RBAC_ERROR_CODES.OWNER_RESTRICTED });
    expect(world.accounts.softDeleted).toEqual([]);
  });

  it('removes a member holding no role without asking rbac', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER, { roleIds: [], storeAccess: 'all', storeIds: [] });

    // Act
    await service.remove(world.ctx, managerOfA, member.id);

    // Assert
    expect(world.log).not.toContain('assertMayChangeHolder');
    expect(world.log).not.toContain('setAccess');
    expect(world.accounts.softDeleted).toEqual([MEMBER]);
  });

  it('behaves as revoke for an invited member', async () => {
    // Arrange
    const member = await pendingMember(world);

    // Act
    await service.remove(world.ctx, managerOfA, member.id);

    // Assert
    expect(revoke).toHaveBeenCalledWith(world.ctx, managerOfA, member.id);
    expect(world.accounts.softDeleted).toEqual([]);
  });

  it('refuses the business owner before asking rbac anything', async () => {
    // Arrange
    const owner = await activeMember(world, OWNER_ID);

    // Act
    const change = service.remove(world.ctx, managerOfA, owner.id);

    // Assert
    await expect(change).rejects.toMatchObject({ code: TEAM_ERROR_CODES.OWNER_PROTECTED });
    expect(world.log).not.toContain('setAccess');
    expect(world.accounts.softDeleted).toEqual([]);
  });

  it('answers member-not-found for an unknown or already removed member', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);
    await service.remove(world.ctx, managerOfA, member.id);

    // Act
    const again = service.remove(world.ctx, managerOfA, member.id);

    // Assert
    await expect(again).rejects.toMatchObject({ code: TEAM_ERROR_CODES.MEMBER_NOT_FOUND });
  });
});
