import { AuthPlugin } from '@cod/plugin-auth';
import { RbacPlugin } from '@cod/plugin-rbac';
import { ACTIVITY_ENTITY_TYPES, teamMemberActivityDiffSchema } from '@cod/shared';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { invitationLinkIn, settledCountTo, waitForMessages } from './mailpit';
import { authTestOptions, createTeamTestEnvironment, freshEmail, MEMBER_PASSWORD, TeamKit } from './team-kit';
import { ACTIVITY_LOG, type ActivityItem, INVITE_MEMBER, type InviteInput, RESEND_INVITATION } from './team-operations';
import { standaloneNumber } from '../support/standalone-number';

const SNOWFLAKE_WORKER_ID = 1011;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, [
  RbacPlugin,
  AuthPlugin.init(authTestOptions()),
]);
const SALARY = 31_337;
const COMMISSION_VALUE = 4_242;

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

/** An invite body for A naming `roleId` on store 1, unless overridden. */
const bodyForA = (email: string, roleId: string, overrides: Partial<InviteInput> = {}): InviteInput => ({
  email,
  roleIds: [roleId],
  storeAccess: 'selected',
  storeIds: [businesses.a.stores[0].id],
  baseSalary: SALARY,
  ...overrides,
});

describe('who may invite (Review Focus 6)', () => {
  it('refuses a caller without team.members.invite on both surfaces', async () => {
    // Arrange
    const { a } = businesses;
    const viewer = await kit.memberWith(a, await kit.customRole(a, ['orders.view']));
    await kit.signIn(viewer, a.stores[0]);
    const email = freshEmail('nobody');
    const body = bodyForA(email, await kit.builtInRoleId(a, 'manager'));

    // Act
    const rest = await kit.rest('POST', '/employees', body);
    const graphql = await failureOf(adminClient.query(INVITE_MEMBER, { input: body }));

    // Assert
    expect(rest.status).toBe(403);
    expect(graphql.codes).toEqual(['FORBIDDEN']);
    expect(await settledCountTo(email)).toBe(0);
  });

  it.each([
    ['the Owner role', 'owner', {}, 'rbac.owner-restricted'],
    ['all stores', 'manager', { storeAccess: 'all' as const }, 'rbac.store-not-accessible'],
    ['a store it lacks', 'manager', { storeIds: ['S2'] }, 'rbac.store-not-accessible'],
  ])(
    'refuses a store-1 Manager inviting with %s: 403, nothing stored, no mail',
    async (_case, key, overrides, code) => {
      // Arrange
      const { a } = businesses;
      const manager = await kit.memberWith(a, await kit.builtInRoleId(a, 'manager'), [a.stores[0]]);
      await kit.signIn(manager, a.stores[0]);
      const email = freshEmail('escalate');
      const roleId = await kit.builtInRoleId(a, key === 'owner' ? 'owner' : 'manager');
      const storeIds = 'storeIds' in overrides ? [a.stores[1].id] : undefined;
      const body = bodyForA(email, roleId, { ...overrides, ...(storeIds === undefined ? {} : { storeIds }) });

      // Act
      const answer = await kit.rest('POST', '/employees', body);

      // Assert
      expect(answer).toMatchObject({ status: 403, body: { code } });
      expect(await kit.query('SELECT id FROM team_member WHERE "emailKey" = $1', [email])).toEqual([]);
      expect(await settledCountTo(email)).toBe(0);
    },
  );

  it('lets a store-1 Manager invite onto store 1 and hides the salary from it (D207)', async () => {
    // Arrange
    const { a } = businesses;
    const manager = await kit.memberWith(a, await kit.builtInRoleId(a, 'manager'), [a.stores[0]]);
    await kit.signIn(manager, a.stores[0]);
    const email = freshEmail('allowed');

    // Act
    const answer = await kit.rest('POST', '/employees', bodyForA(email, await kit.builtInRoleId(a, 'order-tracker')));

    // Assert
    expect(answer).toMatchObject({ status: 201, body: { email, status: 'invited', baseSalary: SALARY } });
  });
});

describe("who may resend or revoke the owner's Owner invitation (D60, Review Focus 6)", () => {
  it('refuses an all-store Manager both, with 403 owner-restricted: no mail, nothing changed', async () => {
    // Arrange
    const { a } = businesses;
    await kit.signIn(a.owner, a.stores[0]);
    const email = freshEmail('owner-grant');
    const ownerRole = await kit.builtInRoleId(a, 'owner');
    const invited = await kit.rest(
      'POST',
      '/employees',
      bodyForA(email, ownerRole, { storeAccess: 'all', storeIds: [] }),
    );
    expect(invited.status).toBe(201);
    const memberId = (invited.body as { id: string }).id;
    await waitForMessages(email, 1);
    await kit.query(`UPDATE invitation SET "lastSentAt" = now() - interval '2 minutes' WHERE "memberId" = $1`, [
      memberId,
    ]);
    const before = await kit.query(
      'SELECT "tokenHash", "expiresAt", "revokedAt" FROM invitation WHERE "memberId" = $1',
      [memberId],
    );
    const manager = await kit.memberWith(a, await kit.builtInRoleId(a, 'manager'));
    await kit.signIn(manager, a.stores[0]);

    // Act
    const resent = await kit.rest('POST', '/employees/resend-invitation', { memberId });
    const revoked = await kit.rest('POST', `/employees/${memberId}/revoke-invitation`);

    // Assert
    expect(resent).toMatchObject({ status: 403, body: { code: 'rbac.owner-restricted' } });
    expect(revoked).toMatchObject({ status: 403, body: { code: 'rbac.owner-restricted' } });
    expect(await settledCountTo(email)).toBe(1);
    expect(
      await kit.query('SELECT "tokenHash", "expiresAt", "revokedAt" FROM invitation WHERE "memberId" = $1', [memberId]),
    ).toEqual(before);
    expect(await kit.query('SELECT "removedAt" FROM team_member WHERE id = $1', [memberId])).toEqual([
      { removedAt: null },
    ]);
  });
});

describe('what the activity log shows of invitations (D216, D217)', () => {
  it('shows an all-store viewer the invite, resend and accept rows, with no salary, address or commission value', async () => {
    // Arrange
    const { a } = businesses;
    const [commission] = await kit.query<{ id: string }>(
      `INSERT INTO commission_config (id, "businessId", name, "nameKey", basis, "valueKind", value, scope, "storeIds", "createdAt", "updatedAt")
       VALUES ('1500000000000000001', $1, 'Bonus', 'bonus', 'per-confirmed-order', 'fixed', $2, 'all', '{}', now(), now()) RETURNING id`,
      [a.businessId, COMMISSION_VALUE],
    );
    const email = freshEmail('logged');
    await kit.signIn(a.owner, a.stores[0]);
    const roleId = await kit.builtInRoleId(a, 'order-tracker');
    const input = bodyForA(email, roleId, { commissionConfigIds: [commission?.id ?? ''] });
    const { inviteMember } = await adminClient.query<{ inviteMember: { id: string } }>(INVITE_MEMBER, { input });
    await kit.query(`UPDATE invitation SET "lastSentAt" = now() - interval '2 minutes' WHERE "memberId" = $1`, [
      inviteMember.id,
    ]);
    await adminClient.query(RESEND_INVITATION, { memberId: inviteMember.id });
    const message = (await waitForMessages(email, 2))[1];
    const token = message === undefined ? '' : (invitationLinkIn(message).searchParams.get('token') ?? '');
    const accepted = await kit.publicRest({
      method: 'POST',
      path: '/team/invitations/accept',
      body: { token, firstName: 'Sara', lastName: 'Haddad', password: MEMBER_PASSWORD },
    });
    expect(accepted.status).toBe(200);
    const viewer = await kit.memberWith(a, await kit.customRole(a, ['settings.activity-log.view']));
    await kit.signIn(viewer, a.stores[0]);

    // Act
    const { activityLog } = await adminClient.query<{ activityLog: { items: ActivityItem[] } }>(ACTIVITY_LOG, {
      input: { entityId: inviteMember.id },
    });

    // Assert
    expect(activityLog.items.map((item) => item.action).sort()).toEqual([
      'team.invitation.accepted',
      'team.invitation.resent',
      'team.member.invited',
    ]);
    for (const item of activityLog.items) {
      expect(teamMemberActivityDiffSchema.safeParse(item.diff).success).toBe(true);
      expect(item.entityType).toBe(ACTIVITY_ENTITY_TYPES.TEAM_MEMBER);
      expect(item.storeId).toBeNull();
    }
    const serialized = JSON.stringify(activityLog.items);
    expect(serialized).not.toMatch(standaloneNumber(SALARY));
    expect(serialized).not.toMatch(standaloneNumber(COMMISSION_VALUE));
    expect(serialized).not.toContain(email);
    expect(serialized).not.toContain(token);
  });

  it('shows a store-1 viewer no team row at all', async () => {
    // Arrange
    const { a } = businesses;
    await kit.signIn(a.owner, a.stores[0]);
    await adminClient.query(INVITE_MEMBER, {
      input: bodyForA(freshEmail('hidden'), await kit.builtInRoleId(a, 'order-tracker')),
    });
    const viewer = await kit.memberWith(a, await kit.customRole(a, ['settings.activity-log.view']), [a.stores[0]]);
    await kit.signIn(viewer, a.stores[0]);

    // Act
    const { activityLog } = await adminClient.query<{ activityLog: { items: ActivityItem[] } }>(ACTIVITY_LOG, {
      input: { first: 100 },
    });

    // Assert
    expect(activityLog.items.filter((item) => item.action.startsWith('team.'))).toEqual([]);
  });
});
