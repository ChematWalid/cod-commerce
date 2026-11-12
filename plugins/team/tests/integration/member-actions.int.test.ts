import { AuthPlugin } from '@cod/plugin-auth';
import { RbacPlugin } from '@cod/plugin-rbac';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authTestOptions, createTeamTestEnvironment, TeamKit } from './team-kit';
import {
  DEACTIVATE_TEAM_MEMBER,
  DELETE_BUSINESS_ROLE,
  MEMBER_ACCESS,
  PAY_TEAM_MEMBER,
  REACTIVATE_TEAM_MEMBER,
  REMOVE_TEAM_MEMBER,
  SET_MEMBER_ACCESS,
  SET_TEAM_MEMBER_LIMIT,
  SET_TEAM_MEMBER_RECEIVING,
  TEAM_ORDER_MANAGERS,
  UPDATE_TEAM_MEMBER,
} from './team-operations';

const SNOWFLAKE_WORKER_ID = 1015;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, [
  RbacPlugin,
  AuthPlugin.init(authTestOptions()),
]);
const LOGIN = gql`
  mutation ($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      __typename
    }
  }
`;

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

/** A role of business A that may read the members list and nothing else. */
const listReaderRole = () => kit.customRole(businesses.a, ['team.members.view']);

/** Signs in as A's owner in a session of its own, leaving any other session open. */
const ownerOfA = () => kit.newSession(businesses.a.owner, businesses.a.stores[0]);

describe('editing a member', () => {
  it("takes effect on the member's next request in a session already open (flush after commit)", async () => {
    // Arrange
    const otherRole = await kit.customRole(businesses.a, ['orders.view']);
    const member = await kit.teamMemberWith(businesses.a, await listReaderRole());
    const token = await kit.newSession(member, businesses.a.stores[0]);
    const before = await kit.rest('GET', '/employees');
    await ownerOfA();

    // Act
    const edit = await kit.rest('PATCH', `/employees/${member.memberId}`, { roleIds: [otherRole] });
    kit.useSession(token, businesses.a.stores[0]);
    const after = await kit.rest('GET', '/employees');

    // Assert
    expect([before.status, edit.status, after.status]).toEqual([200, 200, 403]);
  });
});

describe('deactivating and reactivating a member (D204)', () => {
  it('refuses the old session and rbac setMemberAccess, then reactivate restores the snapshot', async () => {
    // Arrange
    const role = await listReaderRole();
    const member = await kit.teamMemberWith(businesses.a, role);
    const token = await kit.newSession(member, businesses.a.stores[0]);
    await ownerOfA();

    // Act
    const deactivated = await kit.rest('POST', `/employees/${member.memberId}/deactivate`);
    const sideways = await failureOf(
      adminClient.query(SET_MEMBER_ACCESS, {
        input: { administratorId: String(member.administratorId), roleIds: [role], storeAccess: 'all' },
      }),
    );
    kit.useSession(token, businesses.a.stores[0]);
    const oldSession = await kit.rest('GET', '/employees');
    await ownerOfA();
    const reactivated = await kit.rest('POST', `/employees/${member.memberId}/reactivate`);
    const access = await adminClient.query<{ memberAccess: { roles: { id: string }[] } }>(MEMBER_ACCESS, {
      administratorId: String(member.administratorId),
    });

    // Assert
    expect(deactivated).toMatchObject({ status: 200, body: { status: 'inactive' } });
    expect(sideways.codes).toEqual(['rbac.member-suspended']);
    expect(oldSession.status).toBe(403);
    expect(reactivated).toMatchObject({ status: 200, body: { status: 'active' } });
    expect(access.memberAccess.roles.map(({ id }) => id)).toEqual([role]);
  });

  it('fails closed with team.access-unavailable when the former role was deleted, and leaves it inactive (D214)', async () => {
    // Arrange
    const role = await listReaderRole();
    const member = await kit.teamMemberWith(businesses.a, role);
    await ownerOfA();
    await kit.rest('POST', `/employees/${member.memberId}/deactivate`);
    await adminClient.query(DELETE_BUSINESS_ROLE, { id: role });

    // Act
    const reactivated = await kit.rest('POST', `/employees/${member.memberId}/reactivate`);
    const after = await kit.rest('GET', `/employees/${member.memberId}`);

    // Assert
    expect(reactivated).toMatchObject({ status: 409, body: { code: 'team.access-unavailable' } });
    expect(after.body).toMatchObject({ status: 'inactive' });
  });
});

describe('removing a member', () => {
  it('soft-deletes the account, refuses its old session and its login, and frees the address', async () => {
    // Arrange
    const role = await listReaderRole();
    const member = await kit.teamMemberWith(businesses.a, role);
    const token = await kit.newSession(member, businesses.a.stores[0]);
    await ownerOfA();

    // Act
    const removed = await kit.rest('DELETE', `/employees/${member.memberId}`);
    kit.useSession(token, businesses.a.stores[0]);
    const oldSession = await kit.rest('GET', '/employees');
    adminClient.setAuthToken('');
    const login = await adminClient.query<{ login: { __typename: string } }>(LOGIN, {
      username: member.email,
      password: member.password,
    });
    await ownerOfA();
    const invitedAgain = await kit.rest('POST', '/employees', {
      email: member.email,
      roleIds: [role],
      storeAccess: 'all',
      baseSalary: 0,
    });

    // Assert
    expect(removed).toMatchObject({ status: 200, body: { success: true } });
    const [account] = await kit.query<{ deletedAt: Date | null }>(
      'SELECT "deletedAt" FROM administrator WHERE id = $1',
      [member.administratorId],
    );
    expect(account?.deletedAt).not.toBeNull();
    expect(oldSession.status).toBe(403);
    expect(login.login.__typename).toBe('InvalidCredentialsError');
    expect(invitedAgain.status).toBe(201);
  });

  it('protects the business owner from removal and deactivation', async () => {
    // Arrange
    const ownerId = await kit.administratorIdOf(businesses.a.owner.email);
    const ownerMember = await kit.memberIdOf(ownerId);
    const coOwner = await kit.teamMemberWith(businesses.a, await kit.builtInRoleId(businesses.a, 'owner'));
    await kit.newSession(coOwner, businesses.a.stores[0]);

    // Act
    const removed = await kit.rest('DELETE', `/employees/${ownerMember}`);
    const deactivated = await kit.rest('POST', `/employees/${ownerMember}/deactivate`);

    // Assert
    expect(removed).toMatchObject({ status: 403, body: { code: 'team.owner-protected' } });
    expect(deactivated).toMatchObject({ status: 403, body: { code: 'team.owner-protected' } });
  });
});

describe('limit and order intake', () => {
  it('shows the limit and a paused member in the list, and lists only active receiving members as order managers', async () => {
    // Arrange
    const role = await listReaderRole();
    const limited = await kit.teamMemberWith(businesses.a, role);
    const paused = await kit.teamMemberWith(businesses.a, role);
    await ownerOfA();

    // Act
    const zero = await kit.rest('POST', `/employees/${limited.memberId}/limit`, { maxOpenOrders: 0 });
    const limit = await kit.rest('POST', `/employees/${limited.memberId}/limit`, { maxOpenOrders: 7 });
    const pause = await kit.rest('POST', `/employees/${paused.memberId}/receiving`, { receivingOrders: false });
    const list = await kit.rest('GET', '/employees?tab=active');
    const managers = await kit.rest('GET', '/employees/order-managers');

    // Assert
    expect(zero).toMatchObject({ status: 400, body: { code: 'team.invalid-input' } });
    expect([limit.status, pause.status]).toEqual([200, 200]);
    const items = (list.body as { items: { id: string; maxOpenOrders: number | null; receivingOrders: boolean }[] })
      .items;
    expect(items.find((item) => item.id === limited.memberId)).toMatchObject({
      maxOpenOrders: 7,
      receivingOrders: true,
    });
    expect(items.find((item) => item.id === paused.memberId)).toMatchObject({ receivingOrders: false });
    const managerIds = (managers.body as { id: string }[]).map((manager) => manager.id);
    expect(managers.status).toBe(200);
    expect(managerIds).toContain(limited.memberId);
    expect(managerIds).not.toContain(paused.memberId);
  });
});

describe('who may act on members', () => {
  it('refuses every action to a holder of team.members.view alone, on both surfaces', async () => {
    // Arrange
    const target = await kit.teamMemberWith(businesses.a, await listReaderRole());
    const viewer = await kit.teamMemberWith(businesses.a, await listReaderRole());
    await kit.newSession(viewer, businesses.a.stores[0]);
    const base = `/employees/${target.memberId}`;

    // Act
    const statuses = [
      (await kit.rest('PATCH', base, { baseSalary: 1 })).status,
      (await kit.rest('POST', `${base}/limit`, { maxOpenOrders: 2 })).status,
      (await kit.rest('POST', `${base}/receiving`, { receivingOrders: false })).status,
      (await kit.rest('POST', `${base}/deactivate`)).status,
      (await kit.rest('POST', `${base}/reactivate`)).status,
      (await kit.rest('POST', `${base}/pay`, { idempotencyKey: 'k-1' })).status,
      (await kit.rest('DELETE', base)).status,
    ];
    const id = target.memberId;
    const graphql = [
      await failureOf(adminClient.query(UPDATE_TEAM_MEMBER, { id, input: { baseSalary: 1 } })),
      await failureOf(adminClient.query(SET_TEAM_MEMBER_LIMIT, { id, maxOpenOrders: 2 })),
      await failureOf(adminClient.query(SET_TEAM_MEMBER_RECEIVING, { id, receivingOrders: false })),
      await failureOf(adminClient.query(DEACTIVATE_TEAM_MEMBER, { id })),
      await failureOf(adminClient.query(REACTIVATE_TEAM_MEMBER, { id })),
      await failureOf(adminClient.query(PAY_TEAM_MEMBER, { id, idempotencyKey: 'k-1' })),
      await failureOf(adminClient.query(REMOVE_TEAM_MEMBER, { id })),
    ];

    // Assert
    expect(statuses).toEqual([403, 403, 403, 403, 403, 403, 403]);
    expect(graphql.map((failure) => failure.codes)).toEqual(Array.from({ length: 7 }, () => ['FORBIDDEN']));
  });

  it('guards removal by team.members.remove, not team.members.edit, on both surfaces', async () => {
    // Arrange
    const target = await kit.teamMemberWith(businesses.a, await listReaderRole());
    const editor = await kit.teamMemberWith(
      businesses.a,
      await kit.customRole(businesses.a, ['team.members.view', 'team.members.edit']),
    );
    await kit.newSession(editor, businesses.a.stores[0]);

    // Act
    const edited = await kit.rest('PATCH', `/employees/${target.memberId}`, { baseSalary: 2 });
    const removed = await kit.rest('DELETE', `/employees/${target.memberId}`);
    const graphql = await failureOf(adminClient.query(REMOVE_TEAM_MEMBER, { id: target.memberId }));

    // Assert
    expect(edited.status).toBe(200);
    expect(removed.status).toBe(403);
    expect(graphql.codes).toEqual(['FORBIDDEN']);
  });

  it('refuses the order managers to a caller without team.members.view', async () => {
    // Arrange
    const outsider = await kit.teamMemberWith(businesses.a, await kit.customRole(businesses.a, ['orders.view']));
    await kit.newSession(outsider, businesses.a.stores[0]);

    // Act
    const rest = await kit.rest('GET', '/employees/order-managers');
    const graphql = await failureOf(adminClient.query(TEAM_ORDER_MANAGERS));

    // Assert
    expect(rest.status).toBe(403);
    expect(graphql.codes).toEqual(['FORBIDDEN']);
  });
});
