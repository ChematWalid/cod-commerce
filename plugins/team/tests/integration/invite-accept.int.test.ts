import { AuthPlugin } from '@cod/plugin-auth';
import { RbacPlugin } from '@cod/plugin-rbac';
import { createHash } from 'node:crypto';
import { type FeatureKey, registerFeatureGate, type TenantScope } from '@cod/shared';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { Logger } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { invitationLinkIn, settledCountTo, waitForMessages } from './mailpit';
import { authTestOptions, createTeamTestEnvironment, freshEmail, MEMBER_PASSWORD, TeamKit } from './team-kit';
import {
  INVITE_MEMBER,
  type InviteInput,
  MEMBER_ACCESS,
  type MemberAnswer,
  RESEND_INVITATION,
  REVOKE_INVITATION,
} from './team-operations';

const SNOWFLAKE_WORKER_ID = 1009;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, [
  RbacPlugin,
  AuthPlugin.init(authTestOptions()),
]);
const LOG_LEVELS = ['error', 'warn', 'info', 'verbose', 'debug'] as const;
const ACCOUNT_STATUS = gql`
  query {
    accountStatus {
      emailVerified
    }
  }
`;

/** Every feature check the use cases ask for (no plan gate is registered yet: P9.S1). */
const featureChecks: { feature: FeatureKey; scope: TenantScope }[] = [];
registerFeatureGate({
  assertEnabled: (feature, scope) => {
    featureChecks.push({ feature, scope });
    return Promise.resolve();
  },
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

/** Invites as the owner of A, store 2 only, with the Manager role. */
async function inviteToA(email: string, overrides: Partial<InviteInput> = {}): Promise<MemberAnswer> {
  const { a } = businesses;
  await kit.signIn(a.owner, a.stores[0]);
  const input: InviteInput = {
    email,
    roleIds: [await kit.builtInRoleId(a, 'manager')],
    storeAccess: 'selected',
    storeIds: [a.stores[1].id],
    baseSalary: 42_000,
    locale: 'en',
    ...overrides,
  };
  const { inviteMember } = await adminClient.query<{ inviteMember: MemberAnswer }>(INVITE_MEMBER, { input });
  return inviteMember;
}

/** The token of the `nth` invitation mail to `email`. */
async function tokenOf(email: string, nth = 1): Promise<string> {
  const messages = await waitForMessages(email, nth);
  const message = messages[nth - 1];
  if (message === undefined) throw new Error('no such message');
  const link = invitationLinkIn(message);
  expect(`${link.origin}${link.pathname}`).toBe('http://localhost:3100/dashboard/accept-invitation');
  return link.searchParams.get('token') ?? '';
}

const accept = (token: string, ip = '203.0.113.20') =>
  kit.publicRest({
    method: 'POST',
    path: '/team/invitations/accept',
    body: { token, firstName: 'Nadia', lastName: 'Saidi', password: MEMBER_PASSWORD },
    ip,
  });

describe('invite and accept (brief step 2)', () => {
  it('mails a link, and accepting it makes an active member holding exactly the invited role and stores', async () => {
    // Arrange
    const { a } = businesses;
    const email = freshEmail('nadia');
    const invited = await inviteToA(email);
    const token = await tokenOf(email);

    // Act
    const preview = await kit.publicRest({ method: 'GET', path: `/team/invitations/preview?token=${token}` });
    const accepted = await accept(token);

    // Assert
    expect(invited).toMatchObject({ email, status: 'invited', administratorId: null, baseSalary: 42_000 });
    expect(preview.body).toMatchObject({ email, businessName: 'a SARL', inviterName: 'a Owner' });
    expect(accepted).toMatchObject({ status: 200, body: { businessId: a.businessId } });
    const administratorId = await kit.administratorIdOf(email);
    const [member] = await kit.query<{ status: string; administratorId: number }>(
      'SELECT status, "administratorId" FROM team_member WHERE id = $1',
      [invited.id],
    );
    expect(member).toEqual({ status: 'active', administratorId });
    await kit.signIn(a.owner, a.stores[0]);
    const { memberAccess } = await adminClient.query<{ memberAccess: unknown }>(MEMBER_ACCESS, {
      administratorId: String(administratorId),
    });
    expect(memberAccess).toEqual({
      roles: [{ id: await kit.builtInRoleId(a, 'manager') }],
      storeAccess: 'selected',
      storeIds: [a.stores[1].id],
    });
    expect(featureChecks).toContainEqual({ feature: 'team-seats', scope: { businessId: a.businessId } });
  });

  it('gives the account only Authenticated and the role bindings, never UpdateAdministrator, and a verified address', async () => {
    // Arrange
    const { a } = businesses;
    const email = freshEmail('karim');
    await inviteToA(email);
    await accept(await tokenOf(email));
    const administratorId = await kit.administratorIdOf(email);

    // Act
    const roles = await kit.query<{ id: number; permissions: string }>(
      `SELECT r.id, r.permissions FROM administrator a
         JOIN user_roles_role ur ON ur."userId" = a."userId" JOIN role r ON r.id = ur."roleId" WHERE a.id = $1`,
      [administratorId],
    );
    const bindings = await kit.query<{ vendureRoleId: number }>(
      'SELECT "vendureRoleId" FROM role_binding WHERE "businessId" = $1 AND "businessRoleId" = $2',
      [a.businessId, await kit.builtInRoleId(a, 'manager')],
    );
    await kit.signIn({ email, password: MEMBER_PASSWORD }, a.stores[1]);
    const { accountStatus } = await adminClient.query<{ accountStatus: { emailVerified: boolean } }>(ACCOUNT_STATUS);

    // Assert
    expect(roles.length).toBeGreaterThan(0);
    const bound = new Set(bindings.map((binding) => binding.vendureRoleId));
    expect(roles.every((role) => bound.has(role.id))).toBe(true);
    const permissions = roles.flatMap((role) => role.permissions.split(','));
    expect(permissions).toContain('Authenticated');
    expect(permissions).not.toContain('UpdateAdministrator');
    expect(accountStatus.emailVerified).toBe(true);
  });

  it('a resend mails a second link and the first one stops working', async () => {
    // Arrange
    const email = freshEmail('omar');
    const invited = await inviteToA(email);
    const first = await tokenOf(email);
    await kit.query('UPDATE invitation SET "lastSentAt" = now() - interval \'2 minutes\' WHERE "memberId" = $1', [
      invited.id,
    ]);
    await kit.signIn(businesses.a.owner, businesses.a.stores[0]);

    // Act
    await adminClient.query(RESEND_INVITATION, { memberId: invited.id });
    const second = await tokenOf(email, 2);
    const withFirst = await accept(first);
    const withSecond = await accept(second);

    // Assert
    expect(second).not.toBe(first);
    expect(withFirst).toMatchObject({ status: 400, body: { code: 'team.invitation-invalid' } });
    expect(withSecond.status).toBe(200);
  });

  it('a revoked invitation no longer opens, and an expired one is refused with its own code', async () => {
    // Arrange
    const revokedEmail = freshEmail('revoked');
    const revoked = await inviteToA(revokedEmail);
    const revokedToken = await tokenOf(revokedEmail);
    await adminClient.query(REVOKE_INVITATION, { memberId: revoked.id });
    const expiredEmail = freshEmail('expired');
    const expired = await inviteToA(expiredEmail);
    const expiredToken = await tokenOf(expiredEmail);
    await kit.query('UPDATE invitation SET "expiresAt" = now() - interval \'1 second\' WHERE "memberId" = $1', [
      expired.id,
    ]);

    // Act
    const withRevoked = await accept(revokedToken);
    const withExpired = await accept(expiredToken);

    // Assert
    expect(withRevoked).toMatchObject({ status: 400, body: { code: 'team.invitation-invalid' } });
    expect(withExpired).toMatchObject({ status: 400, body: { code: 'team.invitation-expired' } });
    expect(
      await kit.query('SELECT id FROM administrator WHERE "emailAddress" IN ($1, $2)', [revokedEmail, expiredEmail]),
    ).toEqual([]);
  });

  it('two parallel accepts of one token leave one account: one success, one opaque refusal, never a 500', async () => {
    // Arrange
    const email = freshEmail('twice');
    await inviteToA(email);
    const token = await tokenOf(email);

    // Act
    const answers = await Promise.all([accept(token, '203.0.113.31'), accept(token, '203.0.113.32')]);

    // Assert
    expect(answers.map((answer) => answer.status).sort()).toEqual([200, 400]);
    expect(answers.find((answer) => answer.status === 400)?.body).toMatchObject({ code: 'team.invitation-invalid' });
    expect(await kit.query('SELECT id FROM administrator WHERE "emailAddress" = $1', [email])).toHaveLength(1);
  });

  it('never shows the raw token or its stored hash in an answer, an activity row or the server log', async () => {
    // Arrange
    const logged: unknown[] = [];
    const spies = LOG_LEVELS.map((level) =>
      vi.spyOn(Logger, level).mockImplementation((...args: unknown[]) => {
        logged.push(args);
      }),
    );
    const email = freshEmail('secret');
    const invited = await inviteToA(email);
    const token = await tokenOf(email);
    const hash = createHash('sha256').update(token).digest('hex');
    const [stored] = await kit.query<{ tokenHash: string }>(
      'SELECT "tokenHash" FROM invitation WHERE "memberId" = $1',
      [invited.id],
    );

    // Act
    const preview = await kit.publicRest({ method: 'GET', path: `/team/invitations/preview?token=${token}` });
    const accepted = await accept(token);
    const rows = await kit.query('SELECT * FROM activity_log WHERE "entityId" = $1', [invited.id]);
    for (const spy of spies) spy.mockRestore();

    // Assert
    expect(stored?.tokenHash).toBe(hash);
    const seen = JSON.stringify([invited, preview.body, accepted.body, rows, logged]);
    expect(seen).not.toContain(token);
    expect(seen).not.toContain(hash);
    expect(rows).toHaveLength(2);
    expect(await settledCountTo(email, 0)).toBe(1);
  });
});
