import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { MemberLifecycleService } from '../../application/member-lifecycle.service';
import type { MemberGrant } from '../../domain/member-grant';
import {
  activeMember,
  AGENT_ROLE,
  managerOfA,
  type MemberActionWorld,
  memberActionWorld,
  S1,
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
