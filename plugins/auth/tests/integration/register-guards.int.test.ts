import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BOT_CHALLENGE } from '../../application/tokens';
import type { BotChallengePort } from '../../domain/ports/bot-challenge.port';
import { AUTH_TOKEN_HEADER } from './login-test-client';
import { codeOf, createRegisterTestKit, inputFor, uniqueIp } from './register-test-kit';

const REGISTER_IP_LIMIT = 20;
const PUBLIC_CONFIG = 'query { authPublicConfig { oauthEnabled oauthProviders challengeUrl } }';

const { server, client, register, counts, administratorsNamed, start } = createRegisterTestKit();

beforeAll(start);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await server.destroy();
});

describe('server-side validation', () => {
  it.each([
    ['a weak password', { password: 'short' }, 'auth.password-policy'],
    ['a reserved subdomain', { subdomain: 'www' }, 'tenancy.subdomain-invalid'],
    ['a language the platform lacks', { storeLanguage: 'de' }, 'auth.registration-invalid'],
    ['a malformed email', { email: 'not-an-email' }, 'auth.registration-invalid'],
  ])('refuses %s and creates nothing', async (_name, overrides, code) => {
    // Arrange
    const before = await counts();

    // Act
    const answer = await register(inputFor(overrides));

    // Assert
    expect(codeOf(answer)).toBe(code);
    expect(await counts()).toEqual(before);
  });
});

describe('bot challenge', () => {
  const challenge = (): BotChallengePort => server.app.get<BotChallengePort>(BOT_CHALLENGE);

  it('refuses a failed challenge before writing anything', async () => {
    // Arrange
    vi.spyOn(challenge(), 'verify').mockResolvedValueOnce('failed');
    const before = await counts();

    // Act
    const answer = await register(inputFor({ challengeToken: 'synthetic-challenge' }));

    // Assert
    expect(codeOf(answer)).toBe('auth.challenge-failed');
    expect(await counts()).toEqual(before);
  });

  it('proceeds when the challenge provider is unreachable', async () => {
    // Arrange
    vi.spyOn(challenge(), 'verify').mockResolvedValueOnce('unavailable');

    // Act
    const answer = await register(inputFor({ challengeToken: 'synthetic-challenge' }));

    // Assert
    expect(answer.errors).toEqual([]);
  });

  it('ignores the token when the challenge is off', async () => {
    // Act
    const answer = await register(inputFor({ challengeToken: 'not-a-real-challenge' }));

    // Assert
    expect(answer.errors).toEqual([]);
  });
});

describe('registration limits', () => {
  it('limits one address to twenty registrations an hour', async () => {
    // Arrange: refused by validation, so the burst writes nothing and still spends the limit.
    const ip = uniqueIp();
    const burst = Array.from({ length: REGISTER_IP_LIMIT + 5 }, () => register(inputFor({ password: 'short' }), ip));

    // Act
    const answers = await Promise.all(burst);

    // Assert
    const limited = answers.filter((answer) => codeOf(answer) === 'RATE_LIMITED');
    expect(limited.length).toBeGreaterThan(0);
    expect(limited[0]?.headers.get('retry-after')).toBeTruthy();
  });
});

describe('REST and public config', () => {
  it('registers through POST /auth/register', async () => {
    // Arrange
    const input = inputFor();

    // Act
    const response = await client.rest('/auth/register', input, { ip: uniqueIp() });

    // Assert
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ verificationEmailSent: true });
    expect(response.headers.get(AUTH_TOKEN_HEADER)).toBeNull();
    expect(await administratorsNamed(input['email'] as string)).toHaveLength(1);
  });

  it('answers 409 with the code for a taken email', async () => {
    // Arrange
    const first = inputFor();
    await client.rest('/auth/register', first, { ip: uniqueIp() });

    // Act
    const response = await client.rest('/auth/register', inputFor({ email: first['email'] }), { ip: uniqueIp() });

    // Assert
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'auth.email-taken' });
  });

  it('answers 400 for a body that is not a registration', async () => {
    // Act
    const response = await client.rest('/auth/register', { email: 42 }, { ip: uniqueIp() });

    // Assert
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain('auth.registration-invalid');
  });

  it('never echoes the password in a refusal', async () => {
    // Arrange
    const password = 'x'.repeat(100);

    // Act
    const response = await client.rest('/auth/register', inputFor({ password }), { ip: uniqueIp() });

    // Assert
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain(password);
  });

  it('serves the public config on both surfaces with OAuth and the challenge off', async () => {
    // Act
    const rest = await fetch(client.url('/auth/config'));
    const graphql = await client.graphql(PUBLIC_CONFIG);

    // Assert
    const expected = { oauthEnabled: false, oauthProviders: [], challengeUrl: null };
    expect(await rest.json()).toEqual(expected);
    expect(graphql.data?.['authPublicConfig']).toEqual(expected);
  });
});
