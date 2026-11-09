import { AUTH_ERROR_CODES } from '@cod/shared';
import { ConfigService, RequestContext } from '@vendure/core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_TERMINATOR } from '../../application/tokens';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { SessionTerminatorPort } from '../../domain/ports/session-terminator.port';
import { createAccountFlowKit } from './account-flow-kit';
import { waitForMessages } from './mailpit';
import { codeOf, PASSWORD, uniqueIp } from './register-test-kit';

const NEW_PASSWORD = 'synthetic-replacement-password';
const WEAK_PASSWORD = 'short';
const WRONG_PASSWORD = 'synthetic-wrong-password';
const FORBIDDEN = 'FORBIDDEN';
const LIMIT_TRIES = 11;
const FORGOT = `mutation ($email: String!) { requestPasswordReset(emailAddress: $email) { ... on Success { success } } }`;
const CHANGE = `mutation ($current: String!, $next: String!) {
  changeAccountPassword(currentPassword: $current, newPassword: $next) { success }
}`;

const kit = createAccountFlowKit();
const { client } = kit;

const forgot = async (email: string): Promise<string> => {
  await client.graphql(FORGOT, { email }, { ip: uniqueIp() });
  return kit.tokenInMail(email, 2);
};

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('change password', () => {
  it('refuses a wrong current password and changes nothing', async () => {
    // Arrange
    const { email, session } = await kit.owner();

    // Act
    const answer = await client.graphql(CHANGE, { current: WRONG_PASSWORD, next: NEW_PASSWORD }, session);
    const login = await client.login(email, PASSWORD, { ip: uniqueIp() });

    // Assert
    expect(codeOf(answer)).toBe(AUTH_ERROR_CODES.CURRENT_PASSWORD_WRONG);
    expect(login.code).toBe('OK');
  });

  it('refuses a new password outside the policy', async () => {
    // Arrange
    const { session } = await kit.owner();

    // Act
    const answer = await client.graphql(CHANGE, { current: PASSWORD, next: WEAK_PASSWORD }, session);

    // Assert
    expect(codeOf(answer)).toBe(AUTH_ERROR_CODES.PASSWORD_POLICY);
  });

  it('keeps the current session and kills the others at once, even when cached', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const other = await kit.session(email);
    const another = await kit.session(email);
    expect(await client.me(other)).toBe(email);
    expect(await client.me(another)).toBe(email);
    const { sessionCacheStrategy } = kit.server.app.get(ConfigService).authOptions;
    const evict = vi.spyOn(sessionCacheStrategy, 'delete');

    // Act
    const answer = await client.graphql(CHANGE, { current: PASSWORD, next: NEW_PASSWORD }, session);

    // Assert
    expect(answer.errors).toEqual([]);
    expect(await client.me(session)).toBe(email);
    expect(await client.me(other)).toBe(FORBIDDEN);
    expect(await client.me(another)).toBe(FORBIDDEN);
    expect(evict.mock.calls.map(([token]) => token).sort()).toEqual([other.token, another.token].sort());
    expect((await client.login(email, NEW_PASSWORD, { ip: uniqueIp() })).code).toBe('OK');
  });

  it('mails a notice to the account', async () => {
    // Arrange
    const { email, session } = await kit.owner();

    // Act
    await client.graphql(CHANGE, { current: PASSWORD, next: NEW_PASSWORD }, session);
    const messages = await waitForMessages(email, 2);

    // Assert
    expect(messages.at(-1)?.Subject).toContain('password-changed');
  });

  it('voids an earlier open reset link', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const token = await forgot(email);

    // Act
    await client.graphql(CHANGE, { current: PASSWORD, next: NEW_PASSWORD }, session);
    const stale = await client.rest('/auth/reset-password', { token, password: 'synthetic-third-password' });

    // Assert
    expect(await stale.json()).toMatchObject({ code: AUTH_ERROR_CODES.INVALID_TOKEN });
  });

  it('limits guesses at the current password', async () => {
    // Arrange
    const { session } = await kit.owner();
    const answers = [];

    // Act
    for (let tried = 0; tried < LIMIT_TRIES; tried += 1) {
      const answer = await client.graphql(CHANGE, { current: WRONG_PASSWORD, next: NEW_PASSWORD }, session);
      answers.push(codeOf(answer));
    }

    // Assert
    expect(answers.at(-1)).toBe('RATE_LIMITED');
  });

  it('works on REST and needs a session', async () => {
    // Arrange
    const { session } = await kit.owner();
    const body = { currentPassword: PASSWORD, newPassword: NEW_PASSWORD };

    // Act
    const anonymous = await client.rest('/auth/change-password', body);
    const done = await client.rest('/auth/change-password', body, session);

    // Assert
    expect(anonymous.status).toBe(403);
    expect(done.status).toBeLessThan(300);
  });

  it('refuses an anonymous caller', async () => {
    // Act
    const answer = await client.graphql(CHANGE, { current: PASSWORD, next: NEW_PASSWORD });

    // Assert
    expect(codeOf(answer)).toBe(FORBIDDEN);
  });
});

describe('session terminator', () => {
  const terminator = (): SessionTerminatorPort => kit.server.app.get<SessionTerminatorPort>(SESSION_TERMINATOR);
  const operation = RequestContext.empty() as unknown as OperationContext;

  it('endOthers removes every session but the kept one and returns their tokens', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const other = await kit.session(email);
    const [user] = await kit.sql<{ id: number }>(`SELECT "id" FROM "user" WHERE "identifier" = $1`, [email]);

    // Act
    const ended = await terminator().endOthers(operation, String(user?.id), session.token ?? '');

    // Assert
    expect(ended).toEqual([other.token]);
    const rows = await kit.sql<{ token: string }>(`SELECT "token" FROM "session" WHERE "userId" = $1`, [user?.id]);
    expect(rows.map((row) => row.token)).toEqual([session.token]);
  });

  it('flushCache evicts every token and survives a failing cache', async () => {
    // Arrange
    const { sessionCacheStrategy } = kit.server.app.get(ConfigService).authOptions;
    const evict = vi.spyOn(sessionCacheStrategy, 'delete').mockRejectedValueOnce(new Error('cache down'));

    // Act
    await terminator().flushCache(['synthetic-a', 'synthetic-b']);

    // Assert
    expect(evict.mock.calls.map(([token]) => token)).toEqual(['synthetic-a', 'synthetic-b']);
  });
});
