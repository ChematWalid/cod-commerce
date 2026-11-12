import { ACTIVITY_ACTIONS, TEAM_ERROR_CODES, teamMemberActivityDiffSchema, toSnowflake } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { UpdateMemberService } from '../../application/update-member.service';
import {
  activeMember,
  AGENT_ROLE,
  inactiveMember,
  managerOfA,
  type MemberActionWorld,
  memberActionWorld,
  OWNER_ID,
  OWNER_ROLE,
  S1,
  S2,
} from '../fakes/member-action-world';

const MEMBER = 30;
const OTHER_ROLE = toSnowflake('902');
let world: MemberActionWorld;
let service: UpdateMemberService;

beforeEach(() => {
  world = memberActionWorld();
  service = new UpdateMemberService(world.ports);
});

describe('UpdateMemberService.update', () => {
  it('changes roles through rbac inside the business lock and signs the member out after commit', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);

    // Act
    await service.update(world.ctx, managerOfA, { id: member.id, edit: { roleIds: [OTHER_ROLE] } });

    // Assert
    expect(world.access.held.get(MEMBER)).toEqual({ roleIds: [OTHER_ROLE], storeAccess: 'selected', storeIds: [S1] });
    expect(world.log.indexOf('lock:101')).toBeLessThan(world.log.indexOf('setAccess'));
    expect(world.access.flushed).toEqual([[MEMBER]]);
  });

  it('stores salary and commissions and logs only the field names (D216)', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);

    // Act
    const view = await service.update(
      world.ctx,
      managerOfA,
      { id: member.id, edit: { baseSalary: 45_000, commissionConfigIds: [world.commissionId] } },
      { canSeeSalary: true },
    );

    // Assert
    expect(view).toMatchObject({ baseSalary: 45_000, commissionConfigIds: [world.commissionId] });
    expect(world.log).not.toContain('setAccess');
    const [row] = world.activity.rows;
    expect(row?.action).toBe(ACTIVITY_ACTIONS.MEMBER_UPDATED);
    expect(teamMemberActivityDiffSchema.parse(row?.diff).changedFields).toEqual(['baseSalary', 'commissionConfigIds']);
    expect(JSON.stringify(row)).not.toContain('45000');
  });

  it.each([{ baseSalary: 1 }, { commissionConfigIds: [] }])('refuses a self pay edit %j (D212)', async (edit) => {
    // Arrange
    const self = await activeMember(world, managerOfA.administratorId);

    // Act
    const change = service.update(world.ctx, managerOfA, { id: self.id, edit });

    // Assert
    await expect(change).rejects.toMatchObject({ code: TEAM_ERROR_CODES.SELF_ACTION });
  });

  it('refuses a commission of no config of the business', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);

    // Act
    const change = service.update(world.ctx, managerOfA, {
      id: member.id,
      edit: { commissionConfigIds: [toSnowflake('77')] },
    });

    // Assert
    await expect(change).rejects.toMatchObject({ code: TEAM_ERROR_CODES.COMMISSION_NOT_FOUND });
  });

  it('refuses to demote the business owner before asking rbac anything', async () => {
    // Arrange
    const owner = await activeMember(world, OWNER_ID, { roleIds: [OWNER_ROLE], storeAccess: 'all', storeIds: [] });

    // Act
    const change = service.update(world.ctx, managerOfA, { id: owner.id, edit: { roleIds: [AGENT_ROLE] } });

    // Assert
    await expect(change).rejects.toMatchObject({ code: TEAM_ERROR_CODES.OWNER_PROTECTED });
    expect(world.log).not.toContain('setAccess');
  });

  it('refuses a grant beyond a store-limited actor reach (D211)', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);
    world.access.reach = { allStores: false, storeIds: [S1] };

    // Act
    const change = service.update(world.ctx, managerOfA, {
      id: member.id,
      edit: { storeAccess: 'selected', storeIds: [S1, S2] },
    });

    // Assert
    await expect(change).rejects.toMatchObject({ code: TEAM_ERROR_CODES.INVALID_INPUT });
    expect(world.log).not.toContain('setAccess');
  });

  it('refuses to change the access of a deactivated member sideways (D204)', async () => {
    // Arrange
    const member = await inactiveMember(world, MEMBER);

    // Act
    const change = service.update(world.ctx, managerOfA, { id: member.id, edit: { roleIds: [OTHER_ROLE] } });

    // Assert
    await expect(change).rejects.toMatchObject({ code: TEAM_ERROR_CODES.MEMBER_SUSPENDED });
  });
});
