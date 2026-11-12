import { AuthPlugin } from '@cod/plugin-auth';
import { RbacPlugin } from '@cod/plugin-rbac';
import { createHash } from 'node:crypto';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ar from '../../api/i18n/ar.json';
import en from '../../api/i18n/en.json';
import { invitationLinkIn, waitForMessages } from './mailpit';
import {
  authTestOptions,
  createTeamTestEnvironment,
  freshEmail,
  MEMBER_PASSWORD,
  type RestAnswer,
  TeamKit,
} from './team-kit';
import { type InviteInput, RESEND_INVITATION, REVOKE_INVITATION, UPDATE_TEAM_MEMBER } from './team-operations';

const SNOWFLAKE_WORKER_ID = 1013;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, [
  RbacPlugin,
  AuthPlugin.init(authTestOptions()),
]);

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

type Label = 'a' | 'b';

/** Invites `email` over REST as the owner of `label`'s business, Order tracker on its first store. */
async function ownerInvites(label: Label, email: string, overrides: Partial<InviteInput> = {}): Promise<RestAnswer> {
  const business = businesses[label];
  await kit.signIn(business.owner, business.stores[0]);
  const body: InviteInput = {
    email,
    roleIds: [await kit.builtInRoleId(business, 'order-tracker')],
    storeAccess: 'selected',
    storeIds: [business.stores[0].id],
    baseSalary: 20_000,
    ...overrides,
  };
  return kit.rest('POST', '/employees', body);
}

const idOf = (answer: RestAnswer): string => (answer.body as { id: string }).id;
const codeOf = (answer: RestAnswer): string | undefined => (answer.body as { code?: string } | null)?.code;

/** The access rows of both businesses (rbac's assignments and bindings) and every activity row naming `memberId`. */
async function accessAndActivityRows(memberId: string): Promise<unknown[]> {
  const ids = [businesses.a.businessId, businesses.b.businessId];
  const assignments = await kit.query('SELECT * FROM member_role_assignment WHERE "businessId" = ANY($1) ORDER BY id', [
    ids,
  ]);
  const bindings = await kit.query('SELECT * FROM role_binding WHERE "businessId" = ANY($1) ORDER BY id', [ids]);
  const activity = await kit.query('SELECT * FROM activity_log WHERE "entityId" = $1 ORDER BY id', [memberId]);
  return [assignments, bindings, activity];
}

/** The token of the invitation mail to `email` whose link was the `nth` sent. */
async function tokenOf(email: string, nth: number): Promise<string> {
  const message = (await waitForMessages(email, nth))[nth - 1];
  if (message === undefined) throw new Error('no such mail');
  return invitationLinkIn(message).searchParams.get('token') ?? '';
}

const accept = (token: string, language: 'ar' | 'en' = 'en') =>
  kit.publicRest({
    method: 'POST',
    path: '/team/invitations/accept',
    body: { token, firstName: 'Yasmine', lastName: 'Kaci', password: MEMBER_PASSWORD },
    language,
  });

describe('two businesses (multi-tenant check)', () => {
  it('lets A and B invite the same address, each holding only its own member', async () => {
    // Arrange
    const email = freshEmail('both');

    // Act
    const ofA = await ownerInvites('a', email);
    const ofB = await ownerInvites('b', email);

    // Assert
    expect([ofA.status, ofB.status]).toEqual([201, 201]);
    for (const label of ['a', 'b'] as const) {
      const rows = await kit.query<{ id: string }>(
        'SELECT id FROM team_member WHERE "businessId" = $1 AND "emailKey" = $2',
        [businesses[label].businessId, email],
      );
      expect(rows.map((row) => row.id)).toEqual([idOf(label === 'a' ? ofA : ofB)]);
    }
  });

  it("answers not found to B resending or revoking A's member, on both surfaces", async () => {
    // Arrange
    const memberOfA = idOf(await ownerInvites('a', freshEmail('of-a')));
    await kit.query(`UPDATE invitation SET "lastSentAt" = now() - interval '2 minutes' WHERE "memberId" = $1`, [
      memberOfA,
    ]);
    await kit.signIn(businesses.b.owner, businesses.b.stores[0]);

    // Act
    const resend = await kit.rest('POST', '/employees/resend-invitation', { memberId: memberOfA });
    const revoke = await kit.rest('POST', `/employees/${memberOfA}/revoke-invitation`);
    const graphqlResend = await failureOf(adminClient.query(RESEND_INVITATION, { memberId: memberOfA }));
    const graphqlRevoke = await failureOf(adminClient.query(REVOKE_INVITATION, { memberId: memberOfA }));

    // Assert
    expect([resend, revoke].map((answer) => [answer.status, (answer.body as { code: string }).code])).toEqual([
      [404, 'team.member-not-found'],
      [404, 'team.member-not-found'],
    ]);
    expect([...graphqlResend.codes, ...graphqlRevoke.codes]).toEqual([
      'team.member-not-found',
      'team.member-not-found',
    ]);
    const [invitation] = await kit.query<{ revokedAt: Date | null }>(
      'SELECT "revokedAt" FROM invitation WHERE "memberId" = $1',
      [memberOfA],
    );
    expect(invitation?.revokedAt).toBeNull();
  });

  it("refuses B inviting with A's role or store", async () => {
    // Arrange
    const { a } = businesses;

    // Act
    const withRole = await ownerInvites('b', freshEmail('a-role'), {
      roleIds: [await kit.builtInRoleId(a, 'order-tracker')],
    });
    const withStore = await ownerInvites('b', freshEmail('a-store'), { storeIds: [a.stores[0].id] });

    // Assert
    expect([withRole.status, withStore.status]).toEqual([404, 403]);
  });

  it("refuses B's owner giving B's own member A's role or store, on both surfaces, and changes no access", async () => {
    // Arrange
    const { a, b } = businesses;
    const memberOfB = await kit.teamMemberWith(b, await kit.builtInRoleId(b, 'order-tracker'), [b.stores[0]]);
    const edits = [
      { roleIds: [await kit.builtInRoleId(a, 'order-tracker')] },
      { storeAccess: 'selected', storeIds: [a.stores[0].id] },
    ];
    await kit.signIn(b.owner, b.stores[0]);
    const before = await accessAndActivityRows(memberOfB.memberId);

    // Act
    const rest: RestAnswer[] = [];
    const graphql: (readonly string[])[] = [];
    for (const edit of edits) {
      rest.push(await kit.rest('PATCH', `/employees/${memberOfB.memberId}`, edit));
      graphql.push(
        (await failureOf(adminClient.query(UPDATE_TEAM_MEMBER, { id: memberOfB.memberId, input: edit }))).codes,
      );
    }

    // Assert
    expect(rest.map((answer) => [answer.status, codeOf(answer)])).toEqual([
      [404, 'rbac.role-not-found'],
      [403, 'rbac.store-not-accessible'],
    ]);
    expect(graphql).toEqual([['rbac.role-not-found'], ['rbac.store-not-accessible']]);
    expect(await accessAndActivityRows(memberOfB.memberId)).toEqual(before);
  });

  it("makes an account of A that holds no role of B, and fails closed on a grant tampered to B's role", async () => {
    // Arrange
    const { a, b } = businesses;
    const honest = freshEmail('honest');
    const tampered = freshEmail('tampered');
    await ownerInvites('a', honest);
    const tamperedId = idOf(await ownerInvites('a', tampered));
    const roleOfB = await kit.builtInRoleId(b, 'order-tracker');
    await kit.query(
      `UPDATE invitation SET "grant" = jsonb_set("grant", '{roleIds}', jsonb_build_array($2::text)) WHERE "memberId" = $1`,
      [tamperedId, roleOfB],
    );

    // Act
    const honestAnswer = await accept(await tokenOf(honest, 1));
    const tamperedAnswer = await accept(await tokenOf(tampered, 1));

    // Assert
    expect(honestAnswer).toMatchObject({ status: 200, body: { businessId: a.businessId } });
    const [account] = await kit.query<{ businessId: string; id: number }>(
      'SELECT id, "customFieldsBusinessid" AS "businessId" FROM administrator WHERE "emailAddress" = $1',
      [honest],
    );
    expect(account?.businessId).toBe(a.businessId);
    const rolesInB = await kit.query(
      'SELECT id FROM member_role_assignment WHERE "businessId" = $1 AND "administratorId" = $2',
      [b.businessId, account?.id],
    );
    expect(rolesInB).toEqual([]);
    expect(tamperedAnswer).toMatchObject({ status: 400, body: { code: 'team.invitation-invalid' } });
    expect(await kit.query('SELECT id FROM administrator WHERE "emailAddress" = $1', [tampered])).toEqual([]);
  });

  it('accepts the first of two invitations of one address and refuses the second without naming the other business (D201)', async () => {
    // Arrange
    const { a } = businesses;
    const email = freshEmail('twice');
    await ownerInvites('a', email);
    await ownerInvites('b', email);
    const tokens = (await waitForMessages(email, 2)).map(
      (message) => invitationLinkIn(message).searchParams.get('token') ?? '',
    );
    const businessOf = async (token: string) => {
      const hash = createHash('sha256').update(token).digest('hex');
      const [row] = await kit.query<{ businessId: string }>(
        'SELECT "businessId" FROM invitation WHERE "tokenHash" = $1',
        [hash],
      );
      return row?.businessId;
    };
    const tokenA = (await businessOf(tokens[0] ?? '')) === a.businessId ? tokens[0] : tokens[1];
    const tokenB = tokenA === tokens[0] ? tokens[1] : tokens[0];

    // Act
    const first = await accept(tokenA ?? '');
    const inEnglish = await accept(tokenB ?? '', 'en');
    const inArabic = await accept(tokenB ?? '', 'ar');

    // Assert
    expect(first.status).toBe(200);
    expect(inEnglish).toMatchObject({
      status: 409,
      body: { code: 'team.account-elsewhere', message: en.error['team-account-elsewhere'] },
    });
    expect(inArabic).toMatchObject({
      status: 409,
      body: { code: 'team.account-elsewhere', message: ar.error['team-account-elsewhere'] },
    });
    const leaked = JSON.stringify([inEnglish.body, inArabic.body]);
    for (const secret of [
      a.businessId,
      'a SARL',
      'a1 store',
      'a2 store',
      a.stores[0].subdomain,
      a.stores[1].subdomain,
    ]) {
      expect(leaked).not.toContain(secret);
    }
    const [invitationOfB] = await kit.query<{ acceptedAt: Date | null; revokedAt: Date | null }>(
      `SELECT i."acceptedAt", i."revokedAt" FROM invitation i JOIN team_member m ON m.id = i."memberId"
        WHERE m."businessId" = $1 AND m."emailKey" = $2`,
      [businesses.b.businessId, email],
    );
    expect(invitationOfB).toEqual({ acceptedAt: null, revokedAt: null });
  });
});
