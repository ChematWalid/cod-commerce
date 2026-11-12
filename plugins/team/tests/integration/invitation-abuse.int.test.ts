import { AuthPlugin } from '@cod/plugin-auth';
import { RbacPlugin } from '@cod/plugin-rbac';
import { RateLimiter, type RateLimitPolicyName } from '@cod/plugin-rate-limit';
import { MAX_PENDING_INVITATIONS } from '@cod/shared';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { invitationLinkIn, settledCountTo, waitForMessages } from './mailpit';
import { authTestOptions, createTeamTestEnvironment, freshEmail, type RestAnswer, TeamKit } from './team-kit';
import type { InviteInput } from './team-operations';

const SNOWFLAKE_WORKER_ID = 1012;
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

/** Spends every token of `key`'s bucket, as a burst of earlier requests would have. */
async function drain(policy: RateLimitPolicyName, key: string): Promise<void> {
  const limiter = server.app.get(RateLimiter);
  while ((await limiter.consume(policy, key)).allowed) {
    // Keep spending until the bucket refuses.
  }
}

async function bodyFor(business: 'a' | 'b', email: string): Promise<InviteInput> {
  const fixture = businesses[business];
  return {
    email,
    roleIds: [await kit.builtInRoleId(fixture, 'order-tracker')],
    storeAccess: 'all',
    baseSalary: 0,
  };
}

/** Invites as a new Manager of the business, who has its own actor budget. */
async function managerInvites(business: 'a' | 'b', email: string): Promise<{ answer: RestAnswer; adminId: number }> {
  const fixture = businesses[business];
  const manager = await kit.memberWith(fixture, await kit.builtInRoleId(fixture, 'manager'));
  await kit.signIn(manager, fixture.stores[0]);
  return {
    answer: await kit.rest('POST', '/employees', await bodyFor(business, email)),
    adminId: manager.administratorId,
  };
}

const D205_HEADERS = { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' };
const headersOf = (answer: RestAnswer) => ({
  'cache-control': answer.headers.get('cache-control'),
  'referrer-policy': answer.headers.get('referrer-policy'),
});

describe('invitation mail budgets (D205)', () => {
  it("refuses an invite past the business's hourly budget with 429 and no mail", async () => {
    // Arrange
    await drain('team-invite-business', businesses.b.businessId);
    const email = freshEmail('budget-business');

    // Act
    const { answer } = await managerInvites('b', email);

    // Assert
    expect(answer.status).toBe(429);
    expect(await settledCountTo(email)).toBe(0);
  });

  it("refuses an invite past the actor's hourly budget with 429 and no mail", async () => {
    // Arrange
    const { a } = businesses;
    const manager = await kit.memberWith(a, await kit.builtInRoleId(a, 'manager'));
    await drain('team-invite-actor', `${a.businessId}:${String(manager.administratorId)}`);
    await kit.signIn(manager, a.stores[0]);
    const email = freshEmail('budget-actor');

    // Act
    const answer = await kit.rest('POST', '/employees', await bodyFor('a', email));

    // Assert
    expect(answer.status).toBe(429);
    expect(await settledCountTo(email)).toBe(0);
  });

  it('refuses a resend inside the cooldown, past the resend cap and past the resend budget, mailing nothing more', async () => {
    // Arrange
    const email = freshEmail('resend');
    const { answer, adminId } = await managerInvites('a', email);
    const memberId = (answer.body as { id: string }).id;
    await waitForMessages(email);

    // Act
    const cooldown = await kit.rest('POST', '/employees/resend-invitation', { memberId });
    await kit.query(
      `UPDATE invitation SET "lastSentAt" = now() - interval '2 minutes', "resendCount" = 5 WHERE "memberId" = $1`,
      [memberId],
    );
    const capped = await kit.rest('POST', '/employees/resend-invitation', { memberId });
    await drain('team-resend-actor', `${businesses.a.businessId}:${String(adminId)}`);
    const budget = await kit.rest('POST', '/employees/resend-invitation', { memberId });

    // Assert
    expect(cooldown).toMatchObject({ status: 429, body: { code: 'team.resend-cooldown' } });
    expect(capped).toMatchObject({ status: 409, body: { code: 'team.resend-limit' } });
    expect(budget.status).toBe(429);
    expect(await settledCountTo(email)).toBe(1);
  });
});

describe('the public invitation routes (D205, D213)', () => {
  it('answers an unknown, a revoked and an expired token alike, never cached nor referred', async () => {
    // Arrange
    const revokedEmail = freshEmail('p-revoked');
    const expiredEmail = freshEmail('p-expired');
    const revoked = await managerInvites('a', revokedEmail);
    await kit.rest('POST', `/employees/${(revoked.answer.body as { id: string }).id}/revoke-invitation`);
    const expired = await managerInvites('a', expiredEmail);
    await kit.query(`UPDATE invitation SET "expiresAt" = now() - interval '1 second' WHERE "memberId" = $1`, [
      (expired.answer.body as { id: string }).id,
    ]);
    const tokenOf = async (email: string) =>
      invitationLinkIn((await waitForMessages(email))[0] ?? { Subject: '', Text: '' }).searchParams.get('token') ?? '';
    const tokens = ['unknown-token-of-nobody', await tokenOf(revokedEmail), await tokenOf(expiredEmail)];

    // Act
    const answers = [];
    for (const token of tokens) {
      answers.push(await kit.publicRest({ method: 'GET', path: `/team/invitations/preview?token=${token}` }));
    }

    // Assert
    const [first, ...others] = answers.map((answer) => ({ status: answer.status, body: answer.body }));
    expect(first).toMatchObject({
      status: 400,
      body: { code: 'team.invitation-invalid', path: '/team/invitations/preview' },
    });
    for (const other of others) expect(other).toEqual(first);
    for (const answer of answers) expect(headersOf(answer)).toEqual(D205_HEADERS);
    expect(JSON.stringify(answers.map((answer) => answer.body))).not.toContain(tokens[1]);
  });

  it('refuses preview and accept past the per-address budget with 429, still never cached', async () => {
    // Arrange
    const ip = '198.51.100.99';
    await drain('invitation-accept-ip', ip);

    // Act
    const preview = await kit.publicRest({ method: 'GET', path: '/team/invitations/preview?token=x', ip });
    const accept = await kit.publicRest({ method: 'POST', path: '/team/invitations/accept', body: {}, ip });

    // Assert
    expect([preview.status, accept.status]).toEqual([429, 429]);
    expect(headersOf(preview)).toEqual(D205_HEADERS);
  });
});

describe('the pending cap (D205)', () => {
  it('refuses an invite once the business holds the most open invitations, with 429 and no mail', async () => {
    // Arrange
    const { a } = businesses;
    const [{ open } = { open: 0 }] = await kit.query<{ open: number }>(
      `SELECT count(*)::int AS open FROM invitation WHERE "businessId" = $1 AND "acceptedAt" IS NULL
         AND "revokedAt" IS NULL AND "expiresAt" > now()`,
      [a.businessId],
    );
    await kit.query(
      `WITH m AS (
         INSERT INTO team_member (id, "businessId", email, "emailKey", status, "commissionConfigIds", "baseSalary",
           "receivingOrders", "createdAt", "updatedAt")
         SELECT 1600000000000000000 + n, $1, 'cap' || n || '@example.test', 'cap' || n || '@example.test', 'invited',
           '{}', 0, true, now(), now() FROM generate_series(1, $2::int) AS n RETURNING id)
       INSERT INTO invitation (id, "businessId", "memberId", "grant", "tokenHash", locale, "expiresAt", "lastSentAt",
         "resendCount", "invitedByAdministratorId", "createdAt")
       SELECT id + 1000, $1, id, '{"roleIds":[],"storeAccess":"all","storeIds":[]}', md5(id::text) || md5(id::text),
         'ar', now() + interval '1 day', now(), 0, 1, now() FROM m`,
      [a.businessId, MAX_PENDING_INVITATIONS - open],
    );
    const email = freshEmail('capped');

    // Act
    const { answer } = await managerInvites('a', email);

    // Assert
    expect(answer).toMatchObject({ status: 429, body: { code: 'team.too-many-pending' } });
    expect(await settledCountTo(email)).toBe(0);
  });
});
