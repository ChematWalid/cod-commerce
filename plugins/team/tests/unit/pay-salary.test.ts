import { ACTIVITY_ACTIONS, TEAM_ERROR_CODES, teamMemberActivityDiffSchema } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { PaySalaryService } from '../../application/pay-salary.service';
import { scopeA } from '../support/builders';
import {
  activeMember,
  inactiveMember,
  managerOfA,
  type MemberActionWorld,
  memberActionWorld,
  pendingMember,
} from '../fakes/member-action-world';

const MEMBER = 30;
let world: MemberActionWorld;
let service: PaySalaryService;

beforeEach(() => {
  world = memberActionWorld();
  service = new PaySalaryService(world.ports);
});

describe('PaySalaryService.pay', () => {
  it('pays the base salary read at pay time and publishes the same amount once', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER, undefined, { baseSalary: 38_000 });
    await world.members.update(world.ctx, scopeA, member.id, { baseSalary: 41_000 });

    // Act
    const payment = await service.pay(world.ctx, managerOfA, member.id, 'click-1');

    // Assert
    expect(payment).toMatchObject({ memberId: member.id, amount: 41_000, paidByAdministratorId: 2 });
    expect(world.salaries.rows).toHaveLength(1);
    expect(world.salaryPaid.published).toEqual([world.salaries.rows[0]]);
    expect(world.salaryPaid.recipients).toEqual([MEMBER]);
    const [row] = world.activity.rows;
    expect(row?.action).toBe(ACTIVITY_ACTIONS.SALARY_PAID);
    expect(teamMemberActivityDiffSchema.parse(row?.diff)).toEqual({
      memberId: member.id,
      displayName: 'Amina Bensalem',
      changedFields: [],
    });
  });

  it('answers a repeated idempotency key with the first payment and publishes nothing (D212)', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);
    const first = await service.pay(world.ctx, managerOfA, member.id, 'click-1');

    // Act
    const again = await service.pay(world.ctx, managerOfA, member.id, 'click-1');

    // Assert
    expect(again).toEqual(first);
    expect(world.salaries.rows).toHaveLength(1);
    expect(world.salaryPaid.published).toHaveLength(1);
    expect(world.activity.rows).toHaveLength(1);
  });

  it('books two payments under two keys', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);

    // Act
    await service.pay(world.ctx, managerOfA, member.id, 'click-1');
    await service.pay(world.ctx, managerOfA, member.id, 'click-2');

    // Assert
    expect(world.salaryPaid.published).toHaveLength(2);
  });

  it('refuses to pay an invited or a deactivated member', async () => {
    // Arrange
    const invited = await pendingMember(world);
    const inactive = await inactiveMember(world, MEMBER);

    // Act
    const payInvited = service.pay(world.ctx, managerOfA, invited.id, 'click-1');
    const payInactive = service.pay(world.ctx, managerOfA, inactive.id, 'click-1');

    // Assert
    await expect(payInvited).rejects.toMatchObject({ code: TEAM_ERROR_CODES.NOT_ACTIVE });
    await expect(payInactive).rejects.toMatchObject({ code: TEAM_ERROR_CODES.NOT_ACTIVE });
    expect(world.salaryPaid.published).toEqual([]);
  });

  it('refuses a self payment (D212)', async () => {
    // Arrange
    const self = await activeMember(world, managerOfA.administratorId);

    // Act
    const pay = service.pay(world.ctx, managerOfA, self.id, 'click-1');

    // Assert
    await expect(pay).rejects.toMatchObject({ code: TEAM_ERROR_CODES.SELF_ACTION });
    expect(world.salaries.rows).toEqual([]);
  });

  it('refuses an empty or too long idempotency key', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);

    // Act
    const empty = service.pay(world.ctx, managerOfA, member.id, '');
    const long = service.pay(world.ctx, managerOfA, member.id, 'k'.repeat(65));

    // Assert
    await expect(empty).rejects.toMatchObject({ code: TEAM_ERROR_CODES.INVALID_INPUT });
    await expect(long).rejects.toMatchObject({ code: TEAM_ERROR_CODES.INVALID_INPUT });
  });

  it('reads the member under a row lock, after the business lock', async () => {
    // Arrange
    const member = await activeMember(world, MEMBER);
    const locked: string[] = [];
    const findForUpdate = world.members.findForUpdate.bind(world.members);
    world.members.findForUpdate = (ctx, scope, id) => {
      locked.push(id);
      world.log.push('findForUpdate');
      return findForUpdate(ctx, scope, id);
    };

    // Act
    await service.pay(world.ctx, managerOfA, member.id, 'click-1');

    // Assert
    expect(locked).toEqual([member.id]);
    expect(world.log.indexOf('lock:101')).toBeLessThan(world.log.indexOf('findForUpdate'));
  });
});
