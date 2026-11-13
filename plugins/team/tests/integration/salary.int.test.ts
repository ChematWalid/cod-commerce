import { randomBytes } from 'node:crypto';
import { AuthPlugin } from '@cod/plugin-auth';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import {
  DOMAIN_EVENT_NAMES,
  type SalaryPaidPayload,
  teamMemberActivityDiffSchema,
  toBusinessId,
  toSnowflake,
} from '@cod/shared';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PaySalaryService } from '../../application/pay-salary.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { authTestOptions, createTeamTestEnvironment, TeamKit } from './team-kit';
import { ACTIVITY_LOG, type ActivityItem, type PaymentAnswer } from './team-operations';
import { standaloneNumber } from '../support/standalone-number';

const SNOWFLAKE_WORKER_ID = 1016;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, {
  plugins: [RbacPlugin, AuthPlugin.init(authTestOptions())],
  partitionedSchemas: [ACTIVITY_LOG_SCHEMA],
});
/** Distinct values the activity rows must never carry (D216). */
const OLD_SALARY = 52_817;
const NEW_SALARY = 61_234;
const COMMISSION_VALUE = 7_391;

let businesses: TwoBusinesses;
let kit: TeamKit;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  businesses = await createTwoBusinesses(adminClient);
  kit = new TeamKit(server.app, adminClient);
});

afterAll(async () => {
  await server.destroy();
});

/** A `salary.paid` outbox row: written in the paying transaction, so it is there as soon as the pay answered (D222). */
interface SalaryPaidRow {
  readonly businessId: string;
  readonly aggregateId: string;
  readonly payload: SalaryPaidPayload;
}

const outboxRowsOf = (memberId: string) =>
  kit.query<SalaryPaidRow>(
    `SELECT "businessId", "aggregateId", payload FROM outbox_event WHERE topic = $1 AND payload->>'memberId' = $2`,
    [DOMAIN_EVENT_NAMES.SalaryPaid, memberId],
  );

/** An active member of A on every store, its salary set, with the owner signed in. */
async function paidMember(salary: number) {
  const member = await kit.teamMemberWith(businesses.a, await kit.builtInRoleId(businesses.a, 'order-tracker'));
  await kit.newSession(businesses.a.owner, businesses.a.stores[0]);
  await kit.rest('PATCH', `/employees/${member.memberId}`, { baseSalary: salary });
  return member;
}

const paymentRows = (memberId: string) =>
  kit.query<{ id: string; amount: number }>('SELECT id, amount FROM salary_payment WHERE "memberId" = $1', [memberId]);

describe('paying a salary (D212)', () => {
  it('books the base salary once per key, even for two parallel clicks, with one outbox row per payment', async () => {
    // Arrange
    const member = await paidMember(OLD_SALARY);
    const pay = (key: string) => kit.rest('POST', `/employees/${member.memberId}/pay`, { idempotencyKey: key });

    // Act
    const [first, second] = await Promise.all([pay('click-1'), pay('click-1')]);
    const other = await pay('click-2');
    const repeated = await pay('click-2');

    // Assert
    expect([first.status, second.status, other.status, repeated.status]).toEqual([200, 200, 200, 200]);
    expect((repeated.body as PaymentAnswer).id).toBe((other.body as PaymentAnswer).id);
    expect((first.body as PaymentAnswer).id).toBe((second.body as PaymentAnswer).id);
    expect(first.body).toMatchObject({ amount: OLD_SALARY, idempotencyKey: 'click-1' });
    const rows = await paymentRows(member.memberId);
    expect(rows).toHaveLength(2);
    const events = await outboxRowsOf(member.memberId);
    expect(events.map((event) => event.aggregateId).sort()).toEqual(rows.map((row) => row.id).sort());
    expect(events.map((event) => event.payload.paymentId).sort()).toEqual(rows.map((row) => row.id).sort());
    expect(events.every((event) => event.businessId === businesses.a.businessId)).toBe(true);
    expect(events[0]?.payload).toMatchObject({ amount: OLD_SALARY, administratorId: member.administratorId });
  });

  it('pays the amount it stores, whichever of a parallel salary edit and the pay commits first', async () => {
    // Arrange
    const member = await paidMember(OLD_SALARY);

    // Act
    const [, paid] = await Promise.all([
      kit.rest('PATCH', `/employees/${member.memberId}`, { baseSalary: NEW_SALARY }),
      kit.rest('POST', `/employees/${member.memberId}/pay`, { idempotencyKey: 'race-1' }),
    ]);

    // Assert
    const [row] = await paymentRows(member.memberId);
    const [event] = await outboxRowsOf(member.memberId);
    expect([OLD_SALARY, NEW_SALARY]).toContain(row?.amount);
    expect((paid.body as PaymentAnswer).amount).toBe(row?.amount);
    expect(event?.payload.amount).toBe(row?.amount);
  });

  it('stores neither the payment nor its outbox row when the paying transaction rolls back', async () => {
    // Arrange
    const member = await paidMember(OLD_SALARY);
    const app = server.app;
    const ctx = await app.get(RequestContextService).create({ apiType: 'admin' });
    const actor = {
      administratorId: await kit.administratorIdOf(businesses.a.owner.email),
      scope: { businessId: toBusinessId(businesses.a.businessId) },
      ip: null,
      userAgent: null,
    };

    // Act
    const work = app.get(TransactionalConnection).withTransaction(ctx, async (transactional) => {
      await app
        .get(PaySalaryService)
        .pay(asOperationContext(transactional), actor, toSnowflake(member.memberId), 'rolled-back');
      throw new Error('roll the payment back');
    });

    // Assert
    await expect(work).rejects.toThrow('roll the payment back');
    expect(await paymentRows(member.memberId)).toEqual([]);
    expect(await outboxRowsOf(member.memberId)).toEqual([]);
  });

  it('refuses to let the owner pay its own member row', async () => {
    // Arrange
    await kit.newSession(businesses.a.owner, businesses.a.stores[0]);
    const ownerMember = await kit.memberIdOf(await kit.administratorIdOf(businesses.a.owner.email));

    // Act
    const answer = await kit.rest('POST', `/employees/${ownerMember}/pay`, { idempotencyKey: 'self-1' });

    // Assert
    expect(answer).toMatchObject({ status: 403, body: { code: 'team.self-action' } });
  });
});

describe('the activity of member actions, read without team.members.edit (D216)', () => {
  it('names the changed fields but never a salary, a paid amount or a commission value', async () => {
    // Arrange
    const { a } = businesses;
    const commissionId = String(9_000_000_000_000_000n + BigInt(`0x${randomBytes(4).toString('hex')}`));
    await kit.query(
      `INSERT INTO commission_config ("businessId", id, name, "nameKey", basis, "valueKind", value, scope, "storeIds",
         "createdAt", "updatedAt")
       VALUES ($1, $2, 'Bonus', $3, 'per-confirmed-order', 'fixed', $4, 'all', '{}', now(), now())`,
      [a.businessId, commissionId, `bonus-${commissionId}`, COMMISSION_VALUE],
    );
    const member = await paidMember(OLD_SALARY);
    await kit.rest('PATCH', `/employees/${member.memberId}`, {
      baseSalary: NEW_SALARY,
      commissionConfigIds: [commissionId],
    });
    await kit.rest('POST', `/employees/${member.memberId}/pay`, { idempotencyKey: 'logged-1' });
    await kit.rest('POST', `/employees/${member.memberId}/deactivate`);
    const reader = await kit.teamMemberWith(a, await kit.customRole(a, ['settings.activity-log.view']));
    await kit.newSession(reader, a.stores[0]);

    // Act
    const { activityLog } = await adminClient.query<{ activityLog: { items: ActivityItem[] } }>(ACTIVITY_LOG, {});

    // Assert
    const rows = activityLog.items.filter(
      (item) => item.action.startsWith('team.') && item.diff['memberId'] === member.memberId,
    );
    expect(rows.map((row) => row.action)).toEqual(
      expect.arrayContaining(['team.member.updated', 'team.salary.paid', 'team.member.deactivated']),
    );
    const diffs = rows.map((row) => teamMemberActivityDiffSchema.parse(row.diff));
    expect(diffs.flatMap((diff) => diff.changedFields)).toEqual(
      expect.arrayContaining(['baseSalary', 'commissionConfigIds', 'status']),
    );
    const serialized = JSON.stringify(rows);
    for (const secret of [OLD_SALARY, NEW_SALARY, COMMISSION_VALUE])
      expect(serialized).not.toMatch(standaloneNumber(secret));
    expect(serialized).not.toContain(member.email);
  });
});
