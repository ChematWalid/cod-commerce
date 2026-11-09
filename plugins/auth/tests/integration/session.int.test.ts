import { randomUUID } from 'node:crypto';
import { AUTH_ERROR_CODES } from '@cod/shared';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { ConfigService } from '@vendure/core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SESSION_TERMINATOR } from '../../application/tokens';
import type { SessionTerminatorPort } from '../../domain/ports/session-terminator.port';
import { createAuthTestEnvironment } from './auth-test-environment';
import { createTestAdministrator } from './create-test-administrator';
import { type Caller, LoginTestClient } from './login-test-client';

const TOKEN_SECRET = 'integration-test-only-secret-0000000000';
const PASSWORD = 'synthetic-correct-password';
const NEW_PASSWORD = 'synthetic-replacement-password';
const FORBIDDEN = 'FORBIDDEN';
const UPDATE_ACTIVE = `mutation ($input: UpdateActiveAdministratorInput!) {
  updateActiveAdministrator(input: $input) { firstName emailAddress }
}`;

const { server, adminClient } = createAuthTestEnvironment(TOKEN_SECRET, { cookieSessions: true });
const client = new LoginTestClient(() => server.app);

const uniqueIp = (): string => `10.${String(Math.floor(Math.random() * 250))}.${String(Date.now() % 250)}.7`;

async function registeredEmail(): Promise<string> {
  const email = `session-${randomUUID()}@example.test`;
  await createTestAdministrator(adminClient, email, PASSWORD);
  return email;
}

async function bearerSession(email: string): Promise<Caller> {
  const { token } = await client.login(email, PASSWORD, { ip: uniqueIp() });
  return { token: token ?? '' };
}

async function cookieSession(email: string): Promise<Caller> {
  const { cookie } = await client.login(email, PASSWORD, { ip: uniqueIp() });
  return { cookie };
}

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
});

afterAll(async () => {
  await server.destroy();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logout shadows the stock mutation (D21, D22)', () => {
  it('ends only the session that called it, through the plugin resolver', async () => {
    // Arrange
    const email = await registeredEmail();
    const first = await bearerSession(email);
    const second = await bearerSession(email);
    const endCurrent = vi.spyOn(server.app.get<SessionTerminatorPort>(SESSION_TERMINATOR), 'endCurrent');

    // Act
    const answer = await client.logout(first);

    // Assert
    expect(answer.data?.['logout']?.['success']).toBe(true);
    expect(endCurrent).toHaveBeenCalledOnce();
    expect(await client.me(first)).toBe(FORBIDDEN);
    expect(await client.me(second)).toBe(email);
  });

  it('ends only the cookie session when a cookie client logs out', async () => {
    // Arrange
    const email = await registeredEmail();
    const browser = await cookieSession(email);
    const bearer = await bearerSession(email);

    // Act
    await client.logout(browser);

    // Assert
    expect(await client.me(browser)).toBe(FORBIDDEN);
    expect(await client.me(bearer)).toBe(email);
  });

  it('ends only the bearer session when a bearer client logs out', async () => {
    // Arrange
    const email = await registeredEmail();
    const browser = await cookieSession(email);
    const bearer = await bearerSession(email);

    // Act
    await client.logout(bearer);

    // Assert
    expect(await client.me(bearer)).toBe(FORBIDDEN);
    expect(await client.me(browser)).toBe(email);
  });

  it('answers without error for a caller with no session', async () => {
    // Act
    const answer = await client.logout({});

    // Assert
    expect(answer.errors).toEqual([]);
  });

  it('ends only the calling session over REST', async () => {
    // Arrange
    const email = await registeredEmail();
    const first = await bearerSession(email);
    const second = await bearerSession(email);

    // Act
    const response = await client.rest('/auth/logout', {}, first);

    // Assert
    expect(response.status).toBe(200);
    expect(await client.me(first)).toBe(FORBIDDEN);
    expect(await client.me(second)).toBe(email);
  });
});

describe('SessionTerminator', () => {
  it('survives a session cache that fails', async () => {
    // Arrange
    const email = await registeredEmail();
    const session = await bearerSession(email);
    const { sessionCacheStrategy } = server.app.get(ConfigService).authOptions;
    vi.spyOn(sessionCacheStrategy, 'delete').mockRejectedValueOnce(new Error('cache down'));

    // Act
    const answer = await client.logout(session);

    // Assert
    expect(answer.errors).toEqual([]);
    expect(answer.data?.['logout']?.['success']).toBe(true);
  });
});

describe('updateActiveAdministrator shadows the stock mutation (D38)', () => {
  it('refuses a new email', async () => {
    // Arrange
    const session = await bearerSession(await registeredEmail());

    // Act
    const answer = await client.graphql(UPDATE_ACTIVE, { input: { emailAddress: 'other@example.test' } }, session);

    // Assert
    expect(answer.errors[0]?.extensions?.code).toBe(AUTH_ERROR_CODES.USE_ACCOUNT_SECURITY);
  });

  it('saves a new first name sent with the same email', async () => {
    // Arrange
    const email = await registeredEmail();
    const session = await bearerSession(email);
    const input = { emailAddress: email.toUpperCase(), firstName: 'Renamed' };

    // Act
    const answer = await client.graphql(UPDATE_ACTIVE, { input }, session);

    // Assert
    expect(answer.errors).toEqual([]);
    expect(answer.data?.['updateActiveAdministrator']).toEqual({ firstName: 'Renamed', emailAddress: email });
  });

  it('refuses a password and keeps the old one working', async () => {
    // Arrange
    const email = await registeredEmail();
    const session = await bearerSession(email);

    // Act
    const answer = await client.graphql(UPDATE_ACTIVE, { input: { password: NEW_PASSWORD } }, session);

    // Assert
    expect(answer.errors[0]?.extensions?.code).toBe(AUTH_ERROR_CODES.USE_ACCOUNT_SECURITY);
    expect((await client.login(email, PASSWORD, { ip: uniqueIp() })).code).toBe('OK');
  });

  it('refuses an anonymous caller', async () => {
    // Act
    const answer = await client.graphql(UPDATE_ACTIVE, { input: { firstName: 'Nobody' } });

    // Assert
    expect(answer.errors[0]?.extensions?.code).toBe(FORBIDDEN);
  });
});
