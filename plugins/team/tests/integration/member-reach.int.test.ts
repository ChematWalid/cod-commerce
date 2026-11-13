import { AuthPlugin } from '@cod/plugin-auth';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authTestOptions, createTeamTestEnvironment, TeamKit } from './team-kit';
import { ACTIVITY_LOG, type ActivityItem, MEMBER_ACCESS, UPDATE_TEAM_MEMBER } from './team-operations';

const SNOWFLAKE_WORKER_ID = 1017;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, {
  plugins: [RbacPlugin, AuthPlugin.init(authTestOptions())],
  partitionedSchemas: [ACTIVITY_LOG_SCHEMA],
});

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

/** The status and code of every member action on `memberId`, in the order of {@link ACTIONS}. */
async function everyActionOn(memberId: string): Promise<{ status: number; code: unknown }[]> {
  const base = `/employees/${memberId}`;
  const answers = [
    await kit.rest('PATCH', base, { baseSalary: 1 }),
    await kit.rest('POST', `${base}/limit`, { maxOpenOrders: 2 }),
    await kit.rest('POST', `${base}/receiving`, { receivingOrders: false }),
    await kit.rest('POST', `${base}/pay`, { idempotencyKey: 'reach-1' }),
    await kit.rest('POST', `${base}/deactivate`),
    await kit.rest('POST', `${base}/reactivate`),
    await kit.rest('DELETE', base),
  ];
  return answers.map(({ status, body }) => ({ status, code: (body as { code?: unknown } | null)?.code }));
}

const NOT_FOUND = { status: 404, code: 'team.member-not-found' };
const ACTIONS = 7;
/** rbac's refusals of an actor short of an Owner holder's privileges (D60.3, D60.7). */
const OWNER_REFUSALS = ['rbac.owner-restricted', 'rbac.privilege-exceeded'];

describe('store reach of member actions (D211, Review Focus 7)', () => {
  it('answers member-not-found to a store-1 actor for every action on a member of store 2, and changes nothing', async () => {
    // Arrange
    const { a } = businesses;
    const [s1, s2] = a.stores;
    const target = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'order-tracker'), [s2]);
    const actorRole = await kit.customRole(a, ['team.members.view', 'team.members.edit', 'team.members.remove']);
    const actor = await kit.teamMemberWith(a, actorRole, [s1]);
    await kit.newSession(actor, s1);

    // Act
    const answers = await everyActionOn(target.memberId);

    // Assert
    expect(answers).toEqual(Array.from({ length: ACTIONS }, () => NOT_FOUND));
    const [row] = await kit.query<{ status: string; removedAt: Date | null }>(
      'SELECT status, "removedAt" FROM team_member WHERE id = $1',
      [target.memberId],
    );
    expect(row).toEqual({ status: 'active', removedAt: null });
  });

  it("refuses a store-1 actor lifting a store-1 member onto store 2, and leaves the member's stores as they were", async () => {
    // Arrange
    const { a } = businesses;
    const [s1, s2] = a.stores;
    const target = await kit.teamMemberWith(a, await kit.customRole(a, ['team.members.view']), [s1]);
    const actor = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'manager'), [s1]);
    await kit.newSession(actor, s1);

    // Act
    const lifted = await kit.rest('PATCH', `/employees/${target.memberId}`, {
      storeAccess: 'selected',
      storeIds: [s1.id, s2.id],
    });
    await kit.newSession(a.owner, s1);
    const access = await adminClient.query<{ memberAccess: { storeIds: string[] } }>(MEMBER_ACCESS, {
      administratorId: String(target.administratorId),
    });

    // Assert
    expect([400, 403]).toContain(lifted.status);
    expect(access.memberAccess.storeIds).toEqual([s1.id]);
  });

  it('refuses an all-store Manager editing the roles of an Owner holder (Review Focus 6)', async () => {
    // Arrange
    const { a } = businesses;
    const coOwner = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'owner'));
    const manager = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'manager'));
    const trackerRole = await kit.builtInRoleId(a, 'order-tracker');
    await kit.newSession(manager, a.stores[0]);

    // Act
    const demoted = await kit.rest('PATCH', `/employees/${coOwner.memberId}`, { roleIds: [trackerRole] });

    // Assert
    expect(demoted.status).toBe(403);
    expect(OWNER_REFUSALS).toContain((demoted.body as { code: string }).code);
  });

  it('refuses an all-store Manager editing the salary of an Owner holder, and keeps the salary (Review Focus 6)', async () => {
    // Arrange
    const { a } = businesses;
    const coOwner = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'owner'));
    const manager = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'manager'));
    await kit.newSession(manager, a.stores[0]);

    // Act
    const paid = await kit.rest('PATCH', `/employees/${coOwner.memberId}`, { baseSalary: 99_000 });

    // Assert
    expect(paid.status).toBe(403);
    expect(OWNER_REFUSALS).toContain((paid.body as { code: string }).code);
    const [row] = await kit.query<{ baseSalary: number }>('SELECT "baseSalary" FROM team_member WHERE id = $1', [
      coOwner.memberId,
    ]);
    expect(Number(row?.baseSalary)).not.toBe(99_000);
  });

  it('refuses a remover below Owner removing a deactivated co-owner, and keeps its account (D60, D204)', async () => {
    // Arrange
    const { a } = businesses;
    const coOwner = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'owner'));
    await kit.newSession(a.owner, a.stores[0]);
    const deactivated = await kit.rest('POST', `/employees/${coOwner.memberId}/deactivate`);
    const remover = await kit.teamMemberWith(a, await kit.customRole(a, ['team.members.view', 'team.members.remove']));
    await kit.newSession(remover, a.stores[0]);

    // Act
    const removed = await kit.rest('DELETE', `/employees/${coOwner.memberId}`);

    // Assert
    expect(deactivated.status).toBe(200);
    expect(removed.status).toBe(403);
    expect(OWNER_REFUSALS).toContain((removed.body as { code: string }).code);
    const [account] = await kit.query<{ deletedAt: Date | null }>(
      'SELECT "deletedAt" FROM administrator WHERE id = $1',
      [coOwner.administratorId],
    );
    expect(account?.deletedAt).toBeNull();
  });

  it('shows a store-1 log reader no team.* row about a store-2 member (D217)', async () => {
    // Arrange
    const { a } = businesses;
    const [s1, s2] = a.stores;
    const target = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'order-tracker'), [s2]);
    await kit.newSession(a.owner, s1);
    await kit.rest('POST', `/employees/${target.memberId}/limit`, { maxOpenOrders: 4 });
    const reader = await kit.teamMemberWith(a, await kit.customRole(a, ['settings.activity-log.view']), [s1]);
    await kit.newSession(reader, s1);

    // Act
    const { activityLog } = await adminClient.query<{ activityLog: { items: ActivityItem[] } }>(ACTIVITY_LOG, {});

    // Assert
    expect(activityLog.items.filter((item) => item.action.startsWith('team.'))).toEqual([]);
  });
});

describe('two businesses (multi-tenant isolation)', () => {
  it("answers member-not-found to business B's owner for every action on a member of A", async () => {
    // Arrange
    const { a, b } = businesses;
    const memberOfA = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'order-tracker'));
    await kit.newSession(b.owner, b.stores[0]);

    // Act
    const answers = await everyActionOn(memberOfA.memberId);
    const graphql = await failureOf(
      adminClient.query(UPDATE_TEAM_MEMBER, { id: memberOfA.memberId, input: { baseSalary: 1 } }),
    );

    // Assert
    expect(answers).toEqual(Array.from({ length: ACTIONS }, () => NOT_FOUND));
    expect(graphql.codes).toEqual(['team.member-not-found']);
  });

  it("never lists a member of A among B's order managers", async () => {
    // Arrange
    const { a, b } = businesses;
    const memberOfA = await kit.teamMemberWith(a, await kit.builtInRoleId(a, 'order-tracker'));
    const memberOfB = await kit.teamMemberWith(b, await kit.builtInRoleId(b, 'order-tracker'));
    await kit.newSession(b.owner, b.stores[0]);

    // Act
    const managers = await kit.rest('GET', '/employees/order-managers');

    // Assert
    const ids = (managers.body as { id: string }[]).map((manager) => manager.id);
    expect(ids).toContain(memberOfB.memberId);
    expect(ids).not.toContain(memberOfA.memberId);
  });
});
