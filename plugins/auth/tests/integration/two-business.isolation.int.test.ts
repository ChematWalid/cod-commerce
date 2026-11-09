import { AUTH_ERROR_CODES } from '@cod/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GUARDED_OPERATIONS, GUARDED_ROUTES } from './endpoint-registry';
import { png } from './image-fixtures';
import type { Caller, GraphqlAnswer } from './login-test-client';
import { createProfileTestKit } from './profile-test-kit';
import { codeOf, uniqueEmail, uniqueIp } from './register-test-kit';
import { createPairHarness, leaksOf, type Side, snapshotOf } from './two-business-kit';
import {
  CHANGE,
  NEW_PASSWORD,
  PROFILE,
  REGISTER,
  REQUEST,
  RESEND,
  STATUS,
  SUCCESS,
  UPDATE_ACTIVE,
  UPDATE_PROFILE,
} from './two-business-queries';

const kit = createProfileTestKit();
const { client } = kit;
const { withFreshPair, leavesUntouched, loginCode } = createPairHarness(kit);
let a: Side;
let b: Side;

const pairInto = (pair: { a: Side; b: Side }): void => {
  ({ a, b } = pair);
};

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

describe("reads answer the caller's own account", () => {
  withFreshPair(pairInto);
  it('shows A its own status and profile on GraphQL and REST, and nothing of B, even naming a channel of B', async () => {
    // Arrange
    const naming = { ...a.session, channelToken: b.business.stores[0].channelToken };

    // Act
    const answers = [];
    for (const caller of [a.session, naming]) {
      answers.push(await client.graphql(PROFILE, {}, caller), await client.json('GET', '/auth/profile', caller));
      answers.push(await client.graphql(STATUS, {}, caller));
    }

    // Assert
    expect((answers[0] as GraphqlAnswer).data?.['accountProfile']).toMatchObject({ emailAddress: a.email });
    expect(answers[1]).toMatchObject({ status: 200, body: { emailAddress: a.email } });
    for (const answer of answers) {
      expect(leaksOf(answer, b)).toEqual([]);
    }
  });
});

describe("A's writes never touch B", () => {
  withFreshPair(pairInto);
  it('updateAccountProfile as A leaves B unchanged, and B re-reads its own profile', async () => {
    // Act
    await leavesUntouched(b, async () => {
      const done = await client.graphql(
        UPDATE_PROFILE,
        { input: { firstName: 'Changed', phone: '0555123456' } },
        a.session,
      );
      expect(done.errors).toEqual([]);
    });
    const asB = await client.graphql(PROFILE, {}, b.session);

    // Assert
    expect(asB.data?.['accountProfile']).toEqual({ firstName: 'b', emailAddress: b.email });
    expect(await client.json('GET', '/auth/profile', a.session)).toMatchObject({ body: { firstName: 'Changed' } });
  });

  it('PATCH /auth/profile as A leaves B unchanged', async () => {
    // Act
    await leavesUntouched(b, async () => {
      const done = await client.json('PATCH', '/auth/profile', a.session, { firstName: 'Changed' });
      expect(done.status).toBe(200);
    });

    // Assert
    expect(await client.json('GET', '/auth/profile', b.session)).toMatchObject({ body: { firstName: 'b' } });
  });

  it.each(['GraphQL', 'REST'])(
    'the password change over %s moves A only, and the old password is not a current one afterwards',
    async (transport) => {
      // Arrange
      const change = (current: string, next: string): Promise<unknown> =>
        transport === 'GraphQL'
          ? client.graphql(CHANGE, { current, next }, a.session)
          : client.rest('/auth/change-password', { currentPassword: current, newPassword: next }, a.session);

      // Act
      await leavesUntouched(b, async () => {
        await change(a.password, NEW_PASSWORD);
      });
      const wrong = await client.graphql(CHANGE, { current: b.password, next: 'synthetic-another-pass' }, a.session);

      // Assert
      expect(codeOf(wrong)).toBe(AUTH_ERROR_CODES.CURRENT_PASSWORD_WRONG);
      expect(await loginCode(a, NEW_PASSWORD)).toBe('OK');
      expect(await loginCode(a)).toBe('INVALID_CREDENTIALS_ERROR');
      expect(await loginCode(b)).toBe('OK');
    },
  );

  it.each(['GraphQL', 'REST'])(
    'an email change over %s aimed at the address of B touches nothing of B',
    async (transport) => {
      // Act
      await leavesUntouched(b, async () => {
        if (transport === 'GraphQL') {
          const answer = await client.graphql(REQUEST, { email: b.email, password: a.password }, a.session);
          expect(answer.errors).toEqual([]);
        } else {
          const body = { newEmail: b.email, currentPassword: a.password };
          expect(await (await client.rest('/auth/change-email-request', body, a.session)).json()).toEqual(SUCCESS);
        }
      });

      // Assert
      expect(await kit.status(a.session)).toMatchObject({ pendingEmail: b.email });
      expect(await kit.status(b.session)).toMatchObject({ pendingEmail: null });
    },
  );

  it('a resend as A mails A and touches nothing of B', async () => {
    // Act
    await leavesUntouched(b, async () => {
      expect((await client.graphql(RESEND, {}, a.session)).errors).toEqual([]);
    });

    // Assert
    expect(await kit.tokenInMail(a.email)).not.toBe('');
  });

  it('updateActiveAdministrator as A, naming the address of B, is refused and touches nothing of B', async () => {
    // Act and Assert
    await leavesUntouched(b, async () => {
      const answer = await client.graphql(UPDATE_ACTIVE, { input: { emailAddress: b.email } }, a.session);
      expect(codeOf(answer)).toBe(AUTH_ERROR_CODES.USE_ACCOUNT_SECURITY);
    });
  });

  it('logout as A ends the session of A and leaves the sessions of B alive', async () => {
    // Arrange
    const before = await snapshotOf(kit, b);

    // Act
    await client.logout(a.session);

    // Assert
    expect(await client.me(a.session)).toBe('FORBIDDEN');
    expect(await client.me(b.session)).toBe(b.email);
    expect(await snapshotOf(kit, b)).toEqual(before);
  });

  it('registerMerchant as A with the address or the subdomain of B is refused and touches nothing of B', async () => {
    // Arrange
    const input = (overrides: Record<string, unknown>): Record<string, unknown> => ({
      email: uniqueEmail(),
      password: a.password,
      firstName: 'X',
      lastName: 'Y',
      businessName: 'Z',
      storeName: 'Z',
      subdomain: `z${Date.now().toString(36)}`,
      storeLanguage: 'ar',
      emailLocale: 'ar',
      ...overrides,
    });
    const rowsBefore = await kit.counts();

    // Act
    await leavesUntouched(b, async () => {
      const caller = (): Caller => ({ ...a.session, ip: uniqueIp() });
      const email = await client.graphql(REGISTER, { input: input({ email: b.email }) }, caller());
      const subdomain = await client.graphql(
        REGISTER,
        { input: input({ subdomain: b.business.stores[0].subdomain }) },
        caller(),
      );
      expect(codeOf(email)).toBe(AUTH_ERROR_CODES.EMAIL_TAKEN);
      expect(codeOf(subdomain)).toBe('tenancy.subdomain-taken');
    });

    // Assert
    expect(await kit.counts()).toEqual(rowsBefore);
  });
});

describe('every non-public handler refuses a signed-out caller', () => {
  it.each(GUARDED_OPERATIONS.filter((entry) => entry.operation !== 'uploadBusinessLogo'))(
    '$api $operation is FORBIDDEN',
    async ({ api, document, variables }) => {
      // Act
      const response = await client.rest(api === 'admin' ? '/admin-api' : '/shop-api', { query: document, variables });
      const body = (await response.json()) as { errors?: { extensions?: { code?: string } }[] };

      // Assert
      expect(body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    },
  );

  it('admin uploadBusinessLogo is FORBIDDEN', async () => {
    expect(codeOf(await kit.uploadLogo({}, png()))).toBe('FORBIDDEN');
  });

  it.each(GUARDED_ROUTES)('$method $route answers 403', async ({ method, url, body }) => {
    // Act
    const answer = await client.json(method, url, {}, body === undefined ? undefined : { ...body });

    // Assert
    expect(answer.status).toBe(403);
  });
});
