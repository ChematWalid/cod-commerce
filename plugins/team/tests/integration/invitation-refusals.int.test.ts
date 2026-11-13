import { AuthPlugin } from '@cod/plugin-auth';
import { RbacPlugin } from '@cod/plugin-rbac';
import { TEAM_EMAIL_MAX_LENGTH } from '@cod/shared';
import { createMember, createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { invitationLinkIn, settledCountTo, waitForMessages } from './mailpit';
import {
  authTestOptions,
  createTeamTestEnvironment,
  freshEmail,
  MEMBER_PASSWORD,
  type RestAnswer,
  TeamKit,
} from './team-kit';
import type { InviteInput } from './team-operations';

const SNOWFLAKE_WORKER_ID = 1010;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, [
  RbacPlugin,
  AuthPlugin.init(authTestOptions()),
]);
const CREATE_STORE = gql`
  mutation ($input: CreateStoreInput!) {
    createStore(input: $input) {
      id
    }
  }
`;
const ARCHIVE_STORE = gql`
  mutation ($id: String!) {
    archiveStore(id: $id) {
      id
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

/** A valid invite body for A: the Manager role on store 1. */
async function bodyForA(email: string, overrides: Partial<InviteInput> = {}): Promise<InviteInput> {
  const { a } = businesses;
  return {
    email,
    roleIds: [await kit.builtInRoleId(a, 'manager')],
    storeAccess: 'selected',
    storeIds: [a.stores[0].id],
    baseSalary: 30_000,
    ...overrides,
  };
}

/** Invites over REST as the owner of A. */
async function ownerInvites(body: unknown): Promise<RestAnswer> {
  await kit.signIn(businesses.a.owner, businesses.a.stores[0]);
  return kit.rest('POST', '/employees', body);
}

const acceptWith = (token: string) =>
  kit.publicRest({
    method: 'POST',
    path: '/team/invitations/accept',
    body: { token, firstName: 'Lina', lastName: 'Benali', password: MEMBER_PASSWORD },
  });

async function tokenOf(email: string): Promise<string> {
  const [message] = await waitForMessages(email);
  if (message === undefined) throw new Error('no invitation mail');
  return invitationLinkIn(message).searchParams.get('token') ?? '';
}

/** Nothing of an invitation of `email` exists: no member row, no account, no mail. */
async function expectNothingFor(email: string): Promise<void> {
  expect(await kit.query('SELECT id FROM team_member WHERE "emailKey" = $1', [email.trim().toLowerCase()])).toEqual([]);
  expect(await settledCountTo(email)).toBe(0);
}

describe('accept refusals (Review Focus 2 and 3)', () => {
  it('refuses an address that has an account in another business, creating nothing and leaving the token open', async () => {
    // Arrange
    const ownerOfB = businesses.b.owner.email;
    expect((await ownerInvites(await bodyForA(ownerOfB))).status).toBe(201);
    const token = await tokenOf(ownerOfB);

    // Act
    const answer = await acceptWith(token);

    // Assert
    expect(answer).toMatchObject({ status: 409, body: { code: 'team.account-elsewhere' } });
    expect(await kit.query('SELECT id FROM administrator WHERE "emailAddress" = $1', [ownerOfB])).toHaveLength(1);
    const [invitation] = await kit.query<{ acceptedAt: Date | null; revokedAt: Date | null }>(
      `SELECT i."acceptedAt", i."revokedAt" FROM invitation i JOIN team_member m ON m.id = i."memberId"
        WHERE m."businessId" = $1 AND m."emailKey" = $2`,
      [businesses.a.businessId, ownerOfB],
    );
    expect(invitation).toEqual({ acceptedAt: null, revokedAt: null });
  });

  it('refuses an address of this business that is an account but no member', async () => {
    // Arrange
    const { a } = businesses;
    const outsider = await createMember(server.app, adminClient, {
      code: `outsider-${Date.now().toString(36)}`,
      business: a,
      store: a.stores[0],
      permissions: [],
    });
    expect((await ownerInvites(await bodyForA(outsider.email))).status).toBe(201);

    // Act
    const answer = await acceptWith(await tokenOf(outsider.email));

    // Assert
    expect(answer).toMatchObject({ status: 409, body: { code: 'team.account-elsewhere' } });
  });

  it.each(['loses the privilege', 'is removed'])(
    'refuses the accept when the inviter %s, keeps no account and revokes the invitation',
    async (change) => {
      // Arrange
      const { a } = businesses;
      const inviter = await kit.memberWith(a, await kit.builtInRoleId(a, 'manager'));
      const email = freshEmail('late');
      await kit.signIn(inviter, a.stores[0]);
      expect((await kit.rest('POST', '/employees', await bodyForA(email))).status).toBe(201);
      const token = await tokenOf(email);
      const sql =
        change === 'is removed'
          ? 'UPDATE administrator SET "deletedAt" = now() WHERE id = $1'
          : 'DELETE FROM member_role_assignment WHERE "administratorId" = $1';
      await kit.query(sql, [inviter.administratorId]);

      // Act
      const answer = await acceptWith(token);

      // Assert
      expect(answer).toMatchObject({ status: 400, body: { code: 'team.invitation-invalid' } });
      expect(await kit.query('SELECT id FROM administrator WHERE "emailAddress" = $1', [email])).toEqual([]);
      const [invitation] = await kit.query<{ revokedAt: Date | null }>(
        'SELECT i."revokedAt" FROM invitation i JOIN team_member m ON m.id = i."memberId" WHERE m."emailKey" = $1',
        [email],
      );
      expect(invitation?.revokedAt).toBeInstanceOf(Date);
    },
  );
});

describe('invite refusals (Review Focus 4 and 5)', () => {
  it('treats an address with other case and spaces as the same member, in A only', async () => {
    // Arrange
    const email = freshEmail('case');
    expect((await ownerInvites(await bodyForA(email))).status).toBe(201);

    // Act
    const again = await ownerInvites(await bodyForA(`  ${email.toUpperCase()} `));

    // Assert
    expect(again).toMatchObject({ status: 409, body: { code: 'team.email-already-member' } });
    expect(await settledCountTo(email)).toBe(1);
  });

  it.each([
    ['an empty role list', { roleIds: [] }, 400, 'team.invalid-input'],
    ['a negative salary', { baseSalary: -1 }, 400, 'team.invalid-input'],
    ['a fractional salary', { baseSalary: 1.5 }, 400, 'team.invalid-input'],
    ['selected access without a store', { storeIds: [] }, 400, 'team.invalid-input'],
    [
      'an email longer than the stored column',
      { email: `${'a'.repeat(TEAM_EMAIL_MAX_LENGTH)}@shop.test` },
      400,
      'team.invalid-input',
    ],
  ])('refuses %s, storing and mailing nothing', async (_case, overrides, status, code) => {
    // Arrange
    const email = freshEmail('bad');

    // Act
    const answer = await ownerInvites({ ...(await bodyForA(email)), ...overrides });

    // Assert
    expect(answer).toMatchObject({ status, body: { code } });
    await expectNothingFor(email);
  });

  it("refuses B's role, B's store and an archived store of A, storing and mailing nothing", async () => {
    // Arrange
    const { a, b } = businesses;
    await kit.signIn(a.owner, a.stores[0]);
    const { createStore } = await adminClient.query<{ createStore: { id: string } }>(CREATE_STORE, {
      input: { name: 'a3 store', subdomain: `a3-${Date.now().toString(36)}`, language: 'ar' },
    });
    await adminClient.query(ARCHIVE_STORE, { id: createStore.id });
    const emails = [freshEmail('role-b'), freshEmail('store-b'), freshEmail('archived')];
    const bodies = [
      await bodyForA(emails[0] ?? '', { roleIds: [await kit.builtInRoleId(b, 'manager')] }),
      await bodyForA(emails[1] ?? '', { storeIds: [b.stores[0].id] }),
      await bodyForA(emails[2] ?? '', { storeIds: [createStore.id] }),
    ];

    // Act
    const answers = [];
    for (const body of bodies) answers.push(await ownerInvites(body));

    // Assert
    expect(answers.map((answer) => [answer.status, (answer.body as { code: string }).code])).toEqual([
      [404, 'rbac.role-not-found'],
      [403, 'rbac.store-not-accessible'],
      [403, 'rbac.store-not-accessible'],
    ]);
    for (const email of emails) await expectNothingFor(email);
  });
});

describe('withdrawing an invitation whose store was archived since (Review Focus 5 and 6)', () => {
  it('lets the owner revoke it with 200, and the address can be invited again', async () => {
    // Arrange
    const { a } = businesses;
    await kit.signIn(a.owner, a.stores[0]);
    const { createStore } = await adminClient.query<{ createStore: { id: string } }>(CREATE_STORE, {
      input: { name: 'a4 store', subdomain: `a4-${Date.now().toString(36)}`, language: 'ar' },
    });
    const email = freshEmail('store-archived');
    const invited = await ownerInvites(await bodyForA(email, { storeIds: [createStore.id] }));
    expect(invited.status).toBe(201);
    const memberId = (invited.body as { id: string }).id;
    await adminClient.query(ARCHIVE_STORE, { id: createStore.id });

    // Act
    const revoked = await kit.rest('POST', `/employees/${memberId}/revoke-invitation`);
    const again = await ownerInvites(await bodyForA(email));

    // Assert
    expect(revoked.status).toBe(200);
    expect(
      await kit.query('SELECT "removedAt" IS NOT NULL AS removed FROM team_member WHERE id = $1', [memberId]),
    ).toEqual([{ removed: true }]);
    expect(again).toMatchObject({ status: 201, body: { email, status: 'invited' } });
  });
});
