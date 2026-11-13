import { AUTH_ERROR_CODES } from '@cod/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccountFlowKit } from './account-flow-kit';
import { AUTH_TOKEN_HEADER } from './login-test-client';
import { messagesTo, waitForMessages } from './mailpit';
import { PASSWORD, uniqueEmail, uniqueIp } from './register-test-kit';

const NEW_PASSWORD = 'synthetic-replacement-password';
const WEAK_PASSWORD = 'short';
const WRONG_PASSWORD = 'synthetic-wrong-password';
const FORBIDDEN = 'FORBIDDEN';
const LOCKING_FAILURES = 10;
/** Verification at registration, the reset link, then the notice. */
const MAILS_AFTER_RESET = 3;
const PASSWORD_CHANGED_KIND = 'password-changed';
const FORGOT = `mutation ($email: String!) {
  requestPasswordReset(emailAddress: $email) { ... on Success { success } ... on ErrorResult { errorCode } }
}`;
const RESET = `mutation ($token: String!, $password: String!) {
  resetPassword(token: $token, password: $password) {
    __typename
    ... on CurrentUser { identifier channels { code } }
    ... on ErrorResult { errorCode }
  }
}`;

const kit = createAccountFlowKit();
const { client } = kit;

const forgot = async (email: string): Promise<string> => {
  await client.graphql(FORGOT, { email }, { ip: uniqueIp() });
  return kit.tokenInMail(email, 2);
};

const typename = (answer: Awaited<ReturnType<typeof client.graphql>>): unknown =>
  answer.data?.['resetPassword']?.['__typename'];

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

describe('forgot password', () => {
  it('answers a known and an unknown email byte for byte alike, and mails only the known one', async () => {
    // Arrange
    const { email } = await kit.owner();
    const unknown = uniqueEmail();

    // Act
    const known = await client.rest('/auth/forgot-password', { email }, { ip: uniqueIp() });
    const missing = await client.rest('/auth/forgot-password', { email: unknown }, { ip: uniqueIp() });
    const knownBody = await known.text();
    const missingBody = await missing.text();
    await waitForMessages(email, 2);

    // Assert
    expect(known.status).toBe(missing.status);
    expect(knownBody).toBe(missingBody);
    expect(await messagesTo(unknown)).toHaveLength(0);
  });

  it('stores only a hash and leaves the stock reset column empty', async () => {
    // Arrange
    const { email } = await kit.owner();

    // Act
    const token = await forgot(email);
    const rows = await kit.sql<{ tokenHash: string }>(
      `SELECT "tokenHash" FROM "account_token" WHERE "purpose" = 'password-reset' AND "tokenHash" = $1`,
      [token],
    );
    const stock = await kit.sql<{ passwordResetToken: string | null }>(
      `SELECT m."passwordResetToken" FROM "authentication_method" m JOIN "user" u ON u."id" = m."userId"
       WHERE u."identifier" = $1`,
      [email],
    );

    // Assert
    expect(token).not.toBe('');
    expect(rows).toHaveLength(0);
    expect(stock[0]?.passwordResetToken).toBeNull();
  });

  it('accepts the email in any case and with spaces', async () => {
    // Arrange
    const { email } = await kit.owner();

    // Act
    await client.graphql(FORGOT, { email: `  ${email.toUpperCase()} ` }, { ip: uniqueIp() });

    // Assert
    expect(await kit.tokenInMail(email, 2)).not.toBe('');
  });
});

describe('reset password', () => {
  it('refuses a weak password without spending the token', async () => {
    // Arrange
    const { email } = await kit.owner();
    const token = await forgot(email);

    // Act
    const weak = await client.graphql(RESET, { token, password: WEAK_PASSWORD });
    const retried = await client.graphql(RESET, { token, password: NEW_PASSWORD });

    // Assert
    expect(typename(weak)).toBe('PasswordValidationError');
    expect(typename(retried)).toBe('CurrentUser');
  });

  it('is single use, ends every session and the old password, and opens a new session', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const second = await kit.session(email);
    expect(await client.me(session)).toBe(email);
    const token = await forgot(email);

    // Act
    const reset = await client.graphql(RESET, { token, password: NEW_PASSWORD });
    const replay = await client.graphql(RESET, { token, password: NEW_PASSWORD });
    const opened = reset.headers.get(AUTH_TOKEN_HEADER);
    const oldLogin = await client.login(email, PASSWORD, { ip: uniqueIp() });
    const newLogin = await client.login(email, NEW_PASSWORD, { ip: uniqueIp() });

    // Assert
    expect(reset.data?.['resetPassword']?.['identifier']).toBe(email);
    expect(reset.data?.['resetPassword']?.['channels']).not.toEqual([]);
    expect(typename(replay)).toBe('PasswordResetTokenInvalidError');
    expect(await client.me(session)).toBe(FORBIDDEN);
    expect(await client.me(second)).toBe(FORBIDDEN);
    expect(await client.me({ token: opened ?? '' })).toBe(email);
    expect(oldLogin.code).toBe('INVALID_CREDENTIALS_ERROR');
    expect(newLogin.code).toBe('OK');
  });

  it('marks an unverified email verified: the link proved the mailbox', async () => {
    // Arrange
    const { email } = await kit.owner();
    const token = await forgot(email);

    // Act
    const reset = await client.graphql(RESET, { token, password: NEW_PASSWORD });

    // Assert
    expect(await kit.status({ token: reset.headers.get(AUTH_TOKEN_HEADER) ?? '' })).toMatchObject({
      emailVerified: true,
    });
  });

  it('works while the email and address pair is locked out, and clears that lockout', async () => {
    // Arrange
    const { email } = await kit.owner();
    const ip = uniqueIp();
    for (let failed = 0; failed < LOCKING_FAILURES; failed += 1) {
      await client.login(email, WRONG_PASSWORD, { ip });
    }
    const locked = await client.login(email, PASSWORD, { ip });
    const token = await forgot(email);

    // Act
    const reset = await client.graphql(RESET, { token, password: NEW_PASSWORD }, { ip });
    const login = await client.login(email, NEW_PASSWORD, { ip });

    // Assert
    expect(locked.code).toBe('RATE_LIMITED');
    expect(typename(reset)).toBe('CurrentUser');
    expect(login.code).toBe('OK');
  });

  it('mails exactly one password-changed notice to the account email', async () => {
    // Arrange
    const { email } = await kit.owner();
    const token = await forgot(email);

    // Act
    await client.graphql(RESET, { token, password: NEW_PASSWORD });
    const messages = await waitForMessages(email, MAILS_AFTER_RESET);
    const notices = messages.filter((message) => message.Subject.includes(PASSWORD_CHANGED_KIND));

    // Assert
    expect(notices).toHaveLength(1);
    expect(notices[0]?.To.map((to) => to.Address)).toEqual([email]);
  });

  it('opens a session on REST and refuses a replay with the stable code', async () => {
    // Arrange
    const { email } = await kit.owner();
    const token = await forgot(email);

    // Act
    const done = await client.rest('/auth/reset-password', { token, password: NEW_PASSWORD });
    const replay = await client.rest('/auth/reset-password', { token, password: NEW_PASSWORD });

    // Assert
    expect(done.status).toBeLessThan(300);
    expect(await client.me({ token: done.headers.get(AUTH_TOKEN_HEADER) ?? '' })).toBe(email);
    expect(replay.status).toBe(400);
    expect(await replay.json()).toMatchObject({ code: AUTH_ERROR_CODES.INVALID_TOKEN });
  });
});
