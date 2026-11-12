import { AuthPlugin } from '@cod/plugin-auth';
import { RbacPlugin } from '@cod/plugin-rbac';
import { MEMBER_TABS, MEMBERS_PAGE_SIZE, type MemberTab } from '@cod/shared';
import {
  type CredentialsFixture,
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TeamConvergeService } from '../../application/converge-members.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { authTestOptions, createTeamTestEnvironment, freshEmail, TeamKit } from './team-kit';
import {
  ACTIVITY_LOG,
  type ActivityItem,
  type InviteInput,
  type MemberDetailsAnswer,
  type MemberPageAnswer,
  TEAM_MEMBER,
  TEAM_MEMBERS,
} from './team-operations';

const SNOWFLAKE_WORKER_ID = 1014;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, [
  RbacPlugin,
  AuthPlugin.init(authTestOptions()),
]);
const SALARY = 27_500;

/** The members the tests arrange in A (and one in B), by what each one is. */
interface Arranged {
  readonly activeOnS1: string;
  readonly activeOnS2: string;
  readonly pendingOnS1: string;
  readonly expiredOnS2: string;
  readonly inactiveOnS1: string;
  readonly memberOfB: string;
  readonly s1Viewer: CredentialsFixture;
}

let businesses: TwoBusinesses;
let kit: TeamKit;
let arranged: Arranged;

/** Invites `email` as A's owner onto `storeIds` with the Order tracker role; the member's id. */
async function ownerInvites(email: string, storeIds: readonly string[]): Promise<string> {
  const { a } = businesses;
  await kit.signIn(a.owner, a.stores[0]);
  const body: InviteInput = {
    email,
    roleIds: [await kit.builtInRoleId(a, 'order-tracker')],
    storeAccess: 'selected',
    storeIds,
    baseSalary: SALARY,
  };
  const answer = await kit.rest('POST', '/employees', body);
  expect(answer.status).toBe(201);
  return (answer.body as { id: string }).id;
}

/** The Team member row of an administrator, as the converge adopted it (D215). */
async function memberIdOf(email: string): Promise<string> {
  const [row] = await kit.query<{ id: string }>('SELECT id FROM team_member WHERE "emailKey" = $1', [email]);
  if (row === undefined) throw new Error(`no member ${email}`);
  return row.id;
}

async function arrange(): Promise<Arranged> {
  const { a, b } = businesses;
  const [s1, s2] = a.stores;
  const agent = await kit.builtInRoleId(a, 'order-tracker');
  const onS1 = await kit.memberWith(a, agent, [s1]);
  const onS2 = await kit.memberWith(a, agent, [s2]);
  const toDeactivate = await kit.memberWith(a, agent, [s1]);
  const s1Viewer = await kit.memberWith(
    a,
    await kit.customRole(a, ['team.members.view', 'settings.activity-log.view']),
    [s1],
  );
  const ofB = await kit.memberWith(b, await kit.builtInRoleId(b, 'order-tracker'));
  const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
  await server.app.get(TeamConvergeService).convergeMembers(asOperationContext(ctx));
  const inactiveOnS1 = await memberIdOf(toDeactivate.email);
  // Test-only: a deactivated member as Task 13 leaves it, its former grant kept as the snapshot (D204).
  await kit.query(`UPDATE team_member SET status = 'inactive', "suspendedAccess" = $2 WHERE id = $1`, [
    inactiveOnS1,
    JSON.stringify({ roleIds: [agent], storeAccess: 'selected', storeIds: [s1.id] }),
  ]);
  const expiredOnS2 = await ownerInvites(freshEmail('expired'), [s2.id]);
  await kit.query(`UPDATE invitation SET "expiresAt" = now() - interval '1 minute' WHERE "memberId" = $1`, [
    expiredOnS2,
  ]);
  return {
    activeOnS1: await memberIdOf(onS1.email),
    activeOnS2: await memberIdOf(onS2.email),
    pendingOnS1: await ownerInvites(freshEmail('pending'), [s1.id]),
    expiredOnS2,
    inactiveOnS1,
    memberOfB: await memberIdOf(ofB.email),
    s1Viewer,
  };
}

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  businesses = await createTwoBusinesses(adminClient);
  kit = new TeamKit(server.app, adminClient);
  arranged = await arrange();
});

afterAll(async () => {
  await server.destroy();
});

async function pageOf(tab: MemberTab, page = 1): Promise<MemberPageAnswer> {
  const { teamMembers } = await adminClient.query<{ teamMembers: MemberPageAnswer }>(TEAM_MEMBERS, {
    input: { tab, page },
  });
  return teamMembers;
}

const idsOf = (page: MemberPageAnswer): string[] => page.items.map((item) => item.id).sort();

describe('the members list as the owner sees it', () => {
  it('lists every tab with counts equal to the length of each list, and nothing of business B', async () => {
    // Arrange
    await kit.signIn(businesses.a.owner, businesses.a.stores[0]);

    // Act
    const pages = await Promise.all(MEMBER_TABS.map((tab) => pageOf(tab)));

    // Assert
    const [all, active, pending, inactive] = pages as [
      MemberPageAnswer,
      MemberPageAnswer,
      MemberPageAnswer,
      MemberPageAnswer,
    ];
    for (const page of pages) {
      expect(page.counts).toEqual({
        all: all.items.length,
        active: active.items.length,
        pending: pending.items.length,
        inactive: inactive.items.length,
      });
      expect(page.total).toBe(page.items.length);
      expect(page.items.length).toBeLessThanOrEqual(MEMBERS_PAGE_SIZE);
    }
    expect(idsOf(pending)).toEqual([arranged.pendingOnS1, arranged.expiredOnS2].sort());
    expect(idsOf(inactive)).toEqual([arranged.inactiveOnS1]);
    expect(idsOf(active)).toEqual(expect.arrayContaining([arranged.activeOnS1, arranged.activeOnS2]));
    expect(idsOf(all)).not.toContain(arranged.memberOfB);
    expect((await pageOf('all', 2)).items).toEqual([]);
  });

  it('shows roles, store names, the expired mark and the salary to a holder of team.members.edit', async () => {
    // Arrange
    const { a } = businesses;
    await kit.signIn(a.owner, a.stores[0]);
    const [store] = await kit.query<{ name: string }>('SELECT name FROM store WHERE id = $1', [a.stores[1].id]);

    // Act
    const { teamMember } = await adminClient.query<{ teamMember: MemberDetailsAnswer }>(TEAM_MEMBER, {
      id: arranged.expiredOnS2,
    });

    // Assert
    expect(teamMember).toMatchObject({
      status: 'invited',
      tab: 'pending',
      invitationExpired: true,
      roles: [{ id: await kit.builtInRoleId(a, 'order-tracker') }],
      storeAccess: 'selected',
      storeIds: [a.stores[1].id],
      storeNames: [store?.name],
      baseSalary: SALARY,
      ordersCount: 0,
    });
  });

  it('serves the same page over REST, and answers 404 for a member of business B', async () => {
    // Arrange
    await kit.signIn(businesses.a.owner, businesses.a.stores[0]);

    // Act
    const rest = await kit.rest('GET', '/employees?tab=pending&page=1');
    const foreign = await kit.rest('GET', `/employees/${arranged.memberOfB}`);
    const graphqlForeign = await failureOf(adminClient.query(TEAM_MEMBER, { id: arranged.memberOfB }));

    // Assert
    expect(rest.status).toBe(200);
    expect((rest.body as MemberPageAnswer).items.map((item) => item.id).sort()).toEqual(idsOf(await pageOf('pending')));
    expect(foreign).toMatchObject({ status: 404, body: { code: 'team.member-not-found' } });
    expect(graphqlForeign.codes).toEqual(['team.member-not-found']);
  });

  it('searches by email, ignoring case', async () => {
    // Arrange
    await kit.signIn(businesses.a.owner, businesses.a.stores[0]);
    const [row] = await kit.query<{ email: string }>('SELECT email FROM team_member WHERE id = $1', [
      arranged.pendingOnS1,
    ]);

    // Act
    const answer = await kit.rest('GET', `/employees?search=${encodeURIComponent(String(row?.email).toUpperCase())}`);

    // Assert
    expect((answer.body as MemberPageAnswer).items.map((item) => item.id)).toEqual([arranged.pendingOnS1]);
  });
});

describe('who may read the members list', () => {
  it('refuses a caller without team.members.view on both surfaces', async () => {
    // Arrange
    const { a } = businesses;
    const viewer = await kit.memberWith(a, await kit.customRole(a, ['orders.view']));
    await kit.signIn(viewer, a.stores[0]);

    // Act
    const list = await kit.rest('GET', '/employees');
    const one = await kit.rest('GET', `/employees/${arranged.activeOnS1}`);
    const graphql = await failureOf(adminClient.query(TEAM_MEMBERS, { input: {} }));

    // Assert
    expect([list.status, one.status]).toEqual([403, 403]);
    expect(graphql.codes).toEqual(['FORBIDDEN']);
  });

  it('shows a store-1 viewer only members on store 1: not on store 2, not on all stores (D211)', async () => {
    // Arrange
    await kit.signIn(arranged.s1Viewer, businesses.a.stores[0]);
    const viewerId = await memberIdOf(arranged.s1Viewer.email);

    // Act
    const all = await pageOf('all');
    const onS2 = await kit.rest('GET', `/employees/${arranged.activeOnS2}`);
    const expiredOnS2 = await kit.rest('GET', `/employees/${arranged.expiredOnS2}`);

    // Assert
    expect(idsOf(all)).toEqual([arranged.activeOnS1, arranged.pendingOnS1, arranged.inactiveOnS1, viewerId].sort());
    expect(all.counts).toEqual({ all: 4, active: 2, pending: 1, inactive: 1 });
    expect(onS2).toMatchObject({ status: 404, body: { code: 'team.member-not-found' } });
    expect(expiredOnS2.status).toBe(404);
  });

  it('hides the salary from a viewer without team.members.edit (D207)', async () => {
    // Arrange
    await kit.signIn(arranged.s1Viewer, businesses.a.stores[0]);

    // Act
    const { items } = await pageOf('all');

    // Assert
    expect(items.map((item) => item.baseSalary)).toEqual(items.map(() => null));
  });

  it("shows a store-1 viewer no team.* activity row, while the owner's log has them (D217)", async () => {
    // Arrange
    const isTeamRow = (item: ActivityItem): boolean => item.action.startsWith('team.');
    await kit.signIn(businesses.a.owner, businesses.a.stores[0]);
    const ownerLog = await adminClient.query<{ activityLog: { items: ActivityItem[] } }>(ACTIVITY_LOG, {});
    await kit.signIn(arranged.s1Viewer, businesses.a.stores[0]);

    // Act
    const viewerLog = await adminClient.query<{ activityLog: { items: ActivityItem[] } }>(ACTIVITY_LOG, {});

    // Assert
    expect(ownerLog.activityLog.items.some(isTeamRow)).toBe(true);
    expect(viewerLog.activityLog.items.filter(isTeamRow)).toEqual([]);
  });
});
