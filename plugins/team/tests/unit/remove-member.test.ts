import { ACTIVITY_ACTIONS, TEAM_ERROR_CODES } from '@cod/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoveMemberService } from '../../application/remove-member.service';
import type { RevokeInvitationService } from '../../application/revoke-invitation.service';
import {
  activeMember,
  inactiveMember,
  managerOfA,
  type MemberActionWorld,
  memberActionWorld,
  OWNER_ID,
  pendingMember,
} from '../fakes/member-action-world';

const MEMBER = 30;
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

  it('removes a deactivated member without asking rbac again', async () => {
    // Arrange
    const member = await inactiveMember(world, MEMBER);

    // Act
    await service.remove(world.ctx, managerOfA, member.id);

    // Assert
    expect(world.log).not.toContain('setAccess');
    expect(world.accounts.softDeleted).toEqual([MEMBER]);
    expect(world.members.rows[0]).toMatchObject({ suspendedAccess: null });
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
