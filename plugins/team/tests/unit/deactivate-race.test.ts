import { toSnowflake } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { MemberLifecycleService } from '../../application/member-lifecycle.service';
import { RemoveMemberService } from '../../application/remove-member.service';
import { UpdateMemberService } from '../../application/update-member.service';
import type { MemberGrant } from '../../domain/member-grant';
import {
  activeMember,
  AGENT_ROLE,
  managerOfA,
  type MemberActionWorld,
  memberActionWorld,
  S1,
  S2,
} from '../fakes/member-action-world';

const ADMINISTRATOR = 77;
const OTHER_ROLE = toSnowflake('902');
const ROLELESS: MemberGrant = { roleIds: [], storeAccess: 'selected', storeIds: [S1] };

/**
 * rbac's `setMemberAccess` commits `latest` right after Team read the member's access and before Team withdraws it:
 * the read Team made is stale by the time it holds rbac's lock (D804).
 */
function grantCommittedAfterTeamRead(world: MemberActionWorld, latest: MemberGrant): void {
  const read = world.access.accessOf.bind(world.access);
  world.access.accessOf = async (ctx, scope, administratorId) => {
    const seen = await read(ctx, scope, administratorId);
    world.access.held.set(administratorId, latest);
    return seen;
  };
}

describe('MemberLifecycleService.deactivate racing rbac setMemberAccess (D804)', () => {
  it('withdraws a role granted after Team read a roleless member, so the deactivated member holds nothing', async () => {
    // Arrange
    const world = memberActionWorld();
    const member = await activeMember(world, ADMINISTRATOR, ROLELESS);
    const latest: MemberGrant = { roleIds: [AGENT_ROLE], storeAccess: 'selected', storeIds: [S1] };
    grantCommittedAfterTeamRead(world, latest);

    // Act
    await new MemberLifecycleService(world.ports).deactivate(world.ctx, managerOfA, member.id);

    // Assert
    expect(world.access.held.get(ADMINISTRATOR)).toBeUndefined();
    expect(world.members.rows.find((row) => row.id === member.id)).toMatchObject({
      status: 'inactive',
      suspendedAccess: latest,
    });
  });

  it('snapshots the access rbac held when it withdrew it, not the stale read, so reactivate restores the latest', async () => {
    // Arrange
    const world = memberActionWorld();
    const member = await activeMember(world, ADMINISTRATOR);
    const latest: MemberGrant = { roleIds: [OTHER_ROLE], storeAccess: 'selected', storeIds: [S1] };
    grantCommittedAfterTeamRead(world, latest);
    const lifecycle = new MemberLifecycleService(world.ports);

    // Act
    await lifecycle.deactivate(world.ctx, managerOfA, member.id);
    await lifecycle.reactivate(world.ctx, managerOfA, member.id);

    // Assert
    expect(world.access.held.get(ADMINISTRATOR)).toEqual(latest);
  });
});

describe('RemoveMemberService.remove racing rbac setMemberAccess (D804)', () => {
  it('withdraws a role granted after Team read a roleless member, so the removed account holds nothing', async () => {
    // Arrange
    const world = memberActionWorld();
    const member = await activeMember(world, ADMINISTRATOR, ROLELESS);
    grantCommittedAfterTeamRead(world, { roleIds: [AGENT_ROLE], storeAccess: 'selected', storeIds: [S1] });
    const service = new RemoveMemberService(world.ports, { revoke: vi.fn() });

    // Act
    await service.remove(world.ctx, managerOfA, member.id);

    // Assert
    expect(world.access.held.get(ADMINISTRATOR)).toBeUndefined();
  });
});

/**
 * rbac's `setMemberAccess` held rbac's lock first and commits `latest` before Team gets that lock: Team sees it once it
 * holds the lock, and at the latest when it writes (D804).
 */
function rbacCommitsBeforeTeamGetsItsLock(world: MemberActionWorld, latest: MemberGrant): void {
  let pending = true;
  const commit = (): void => {
    if (pending) world.access.held.set(ADMINISTRATOR, latest);
    pending = false;
  };
  const hold = world.access.holdAccess.bind(world.access);
  world.access.holdAccess = async (ctx, scope) => {
    await hold(ctx, scope);
    commit();
  };
  const write = world.access.setAccess.bind(world.access);
  world.access.setAccess = async (ctx, actor, administratorId, grant) => {
    commit();
    await write(ctx, actor, administratorId, grant);
  };
}

describe('UpdateMemberService.update racing rbac setMemberAccess (D804)', () => {
  it('edits the access rbac holds under its lock, so a role rbac withdrew is not written back', async () => {
    // Arrange
    const world = memberActionWorld();
    const member = await activeMember(world, ADMINISTRATOR, {
      roleIds: [AGENT_ROLE, OTHER_ROLE],
      storeAccess: 'selected',
      storeIds: [S1],
    });
    rbacCommitsBeforeTeamGetsItsLock(world, { roleIds: [AGENT_ROLE], storeAccess: 'selected', storeIds: [S1] });

    // Act
    await new UpdateMemberService(world.ports).update(world.ctx, managerOfA, {
      id: member.id,
      edit: { storeIds: [S2] },
    });

    // Assert
    expect(world.access.held.get(ADMINISTRATOR)).toEqual({
      roleIds: [AGENT_ROLE],
      storeAccess: 'selected',
      storeIds: [S2],
    });
  });

  it("takes rbac's lock right after Team's own, before reading the member (D213 order)", async () => {
    // Arrange
    const world = memberActionWorld();
    const member = await activeMember(world, ADMINISTRATOR);

    // Act
    await new UpdateMemberService(world.ports).update(world.ctx, managerOfA, {
      id: member.id,
      edit: { storeIds: [S2] },
    });

    // Assert
    expect(world.log.slice(0, 2)).toEqual([`lock:${member.businessId}`, 'holdAccess']);
  });
});
