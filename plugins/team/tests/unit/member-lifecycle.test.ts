import { ACTIVITY_ACTIONS, RBAC_ERROR_CODES, TEAM_ERROR_CODES, teamMemberActivityDiffSchema } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemberLifecycleService } from '../../application/member-lifecycle.service';
import { scopeA } from '../support/builders';
import {
  activeMember,
  AGENT_ROLE,
  inactiveMember,
  managerOfA,
  type MemberActionWorld,
  memberActionWorld,
  OWNER_ID,
  pendingMember,
  S1,
  S2,
} from '../fakes/member-action-world';
import { RbacRefusal } from '../fakes/invitation-world';

const MEMBER = 30;
let world: MemberActionWorld;
let lifecycle: MemberLifecycleService;

beforeEach(() => {
  world = memberActionWorld();
  lifecycle = new MemberLifecycleService(world.ports);
});

describe('MemberLifecycleService.setLimit', () => {
  it.each([0, -1])('refuses %d and changes nothing', async (limit) => {
    // Arrange
    const member = await activeMember(world, MEMBER);

    // Act
    const change = lifecycle.setLimit(world.ctx, managerOfA, { id: member.id, maxOpenOrders: limit });

    // Assert
    await expect(change).rejects.toMatchObject({ code: TEAM_ERROR_CODES.INVALID_INPUT });
    expect(world.members.rows[0]?.maxOpenOrders).toBeNull();
  });

  it('stores a limit, clears it with null, and logs the field without its value', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);

    // Act
    const limited = await lifecycle.setLimit(world.ctx, managerOfA, { id: member.id, maxOpenOrders: 12 });
    const cleared = await lifecycle.setLimit(world.ctx, managerOfA, { id: member.id, maxOpenOrders: null });

    // Assert
    expect(limited.maxOpenOrders).toBe(12);
    expect(cleared.maxOpenOrders).toBeNull();
    const [row] = world.activity.rows;
    expect(row?.action).toBe(ACTIVITY_ACTIONS.MEMBER_UPDATED);
    expect(teamMemberActivityDiffSchema.parse(row?.diff).changedFields).toEqual(['maxOpenOrders']);
  });

  it('answers member-not-found for a member out of a store-limited actor reach (D211)', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER, {
      roleIds: [AGENT_ROLE],
      storeAccess: 'selected',
      storeIds: [S2],
    });
    world.access.reach = { allStores: false, storeIds: [S1] };

    // Act
    const change = lifecycle.setLimit(world.ctx, managerOfA, { id: member.id, maxOpenOrders: 3 });

    // Assert
    await expect(change).rejects.toMatchObject({ code: TEAM_ERROR_CODES.MEMBER_NOT_FOUND });
  });
});

describe('MemberLifecycleService.setReceiving', () => {
  it('stops and resumes receiving orders and keeps the status', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);

    // Act
    const stopped = await lifecycle.setReceiving(world.ctx, managerOfA, { id: member.id, receivingOrders: false });

    // Assert
    expect(stopped).toMatchObject({ receivingOrders: false, status: 'active' });
    expect(
      (await lifecycle.setReceiving(world.ctx, managerOfA, { id: member.id, receivingOrders: true })).receivingOrders,
    ).toBe(true);
  });
});

describe('MemberLifecycleService.deactivate', () => {
  it('snapshots the access, clears it in rbac with no role, and signs the member out after commit', async () => {
    // Arrange
    const grant = { roleIds: [AGENT_ROLE], storeAccess: 'selected' as const, storeIds: [S1] };
    const member = await activeMember(world, MEMBER, grant);

    // Act
    const view = await lifecycle.deactivate(world.ctx, managerOfA, member.id);

    // Assert
    expect(view.status).toBe('inactive');
    expect(world.members.rows[0]?.suspendedAccess).toEqual(grant);
    expect(world.access.grants.at(-1)).toMatchObject({ administratorId: MEMBER, grant: { roleIds: [] } });
    expect(world.access.held.has(MEMBER)).toBe(false);
    expect(world.access.flushed).toEqual([[MEMBER]]);
    expect(world.log.indexOf('flush')).toBeGreaterThan(world.log.indexOf('setAccess'));
    expect(world.activity.rows.map((row) => row.action)).toEqual([ACTIVITY_ACTIONS.MEMBER_DEACTIVATED]);
  });

  it('refuses the business owner before asking rbac anything', async () => {
    // Arrange
    const owner = await activeMember(world, OWNER_ID, { roleIds: [AGENT_ROLE], storeAccess: 'all', storeIds: [] });

    // Act
    const change = lifecycle.deactivate(world.ctx, managerOfA, owner.id);

    // Assert
    await expect(change).rejects.toMatchObject({ code: TEAM_ERROR_CODES.OWNER_PROTECTED });
    expect(world.log).not.toContain('setAccess');
    expect(world.members.rows[0]?.status).toBe('active');
  });

  it('refuses an invited member, and leaves it as it was', async () => {
    // Arrange
    const member = await pendingMember(world);

    // Act
    const change = lifecycle.deactivate(world.ctx, managerOfA, member.id);

    // Assert
    await expect(change).rejects.toMatchObject({ code: TEAM_ERROR_CODES.NOT_ACTIVE });
  });

  it('keeps the member active when rbac refuses the clear', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);
    world.access.setAccessRefusal = new RbacRefusal(RBAC_ERROR_CODES.PRIVILEGE_EXCEEDED);

    // Act
    const change = lifecycle.deactivate(world.ctx, managerOfA, member.id);

    // Assert
    await expect(change).rejects.toMatchObject({ code: RBAC_ERROR_CODES.PRIVILEGE_EXCEEDED });
    expect(world.members.rows[0]).toMatchObject({ status: 'active', suspendedAccess: null });
    expect(world.access.flushed).toEqual([]);
  });
});

describe('MemberLifecycleService.reactivate', () => {
  it('restores the snapshot through rbac and clears it', async () => {
    // Arrange
    const snapshot = { roleIds: [AGENT_ROLE], storeAccess: 'selected' as const, storeIds: [S1] };
    const member = await inactiveMember(world, MEMBER, snapshot);

    // Act
    const view = await lifecycle.reactivate(world.ctx, managerOfA, member.id);

    // Assert
    expect(view.status).toBe('active');
    expect(world.members.rows[0]?.suspendedAccess).toBeNull();
    expect(world.access.held.get(MEMBER)).toEqual(snapshot);
    expect(world.access.flushed).toEqual([[MEMBER]]);
  });

  it.each([
    RBAC_ERROR_CODES.ROLE_NOT_FOUND,
    RBAC_ERROR_CODES.STORE_NOT_ACCESSIBLE,
    RBAC_ERROR_CODES.PRIVILEGE_EXCEEDED,
  ])('answers access-unavailable for rbac %s and leaves the member inactive (D214)', async (code) => {
    // Arrange
    const member = await inactiveMember(world, MEMBER);
    world.access.setAccessRefusal = new RbacRefusal(code);

    // Act
    const change = lifecycle.reactivate(world.ctx, managerOfA, member.id);

    // Assert
    await expect(change).rejects.toMatchObject({ code: TEAM_ERROR_CODES.ACCESS_UNAVAILABLE });
    expect(world.members.rows[0]).toMatchObject({ status: 'inactive', suspendedAccess: { roleIds: [AGENT_ROLE] } });
    expect(world.activity.rows).toEqual([]);
  });

  it('takes the business lock before rbac is asked anything (D213)', async () => {
    // Arrange
    const member = await inactiveMember(world, MEMBER);

    // Act
    await lifecycle.reactivate(world.ctx, managerOfA, member.id);

    // Assert
    expect(world.log.indexOf(`lock:${scopeA.businessId}`)).toBeLessThan(world.log.indexOf('setAccess'));
  });
});
