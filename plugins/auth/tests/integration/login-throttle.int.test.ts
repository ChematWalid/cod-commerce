import { randomUUID } from 'node:crypto';
import { RateLimiter } from '@cod/plugin-rate-limit';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SECRET_HASHER } from '../../application/tokens';
import { loginEmailKey, loginPairKey } from '../../domain/login-throttle-keys';
import type { SecretHasherPort } from '../../domain/ports/secret-hasher.port';
import { createAuthTestEnvironment } from './auth-test-environment';
import { createTestAdministrator } from './create-test-administrator';
import { AUTH_TOKEN_HEADER, LoginTestClient } from './login-test-client';

const TOKEN_SECRET = 'integration-test-only-secret-0000000000';
const PASSWORD = 'synthetic-correct-password';
const WRONG_PASSWORD = 'synthetic-wrong-password';
const PAIR_LIMIT = 10;
const IP_LIMIT = 60;
const FIRST_LOCKOUT_SECONDS = 60;
/** Enough refused failures that re-locking on each would climb the doubling series to its cap. */
const OVER_LIMIT_BURST = 30;
/** Over the limit by enough that the token a second refilled during the burst cannot absorb it all. */
const IP_BURST = 80;
const INVALID = 'INVALID_CREDENTIALS_ERROR';
const LIMITED = 'RATE_LIMITED';

const { server, adminClient } = createAuthTestEnvironment(TOKEN_SECRET);
const client = new LoginTestClient(() => server.app);
let limiter: RateLimiter;

/** Limiter keys outlive a test run in Valkey, so every test uses addresses and accounts of its own. */
const uniqueIp = (): string => {
  const bytes = randomUUID().replaceAll('-', '').match(/../g) ?? [];
  return bytes
    .slice(0, 4)
    .map((byte) => parseInt(byte, 16))
    .join('.');
};
const emailKeyOf = (email: string): string => loginEmailKey(server.app.get<SecretHasherPort>(SECRET_HASHER), email);
const uniqueEmail = (): string => `owner-${randomUUID()}@example.test`;

async function registeredEmail(): Promise<string> {
  const email = uniqueEmail();
  await createTestAdministrator(adminClient, email, PASSWORD);
  return email;
}

/** Concurrent, so a slow password hash cannot let the bucket refill a token in the middle of the burst. */
async function failTimes(email: string, ip: string, times: number): Promise<string[]> {
  const attempts = Array.from({ length: times }, () => client.login(email, WRONG_PASSWORD, { ip }));
  return (await Promise.all(attempts)).map((answer) => answer.code);
}

/** The answers an attacker on one IP and the owner on another see, in order. */
async function attackSequence(email: string, password: string): Promise<(string | undefined)[]> {
  const attackerIp = uniqueIp();
  const otherIp = uniqueIp();
  const failures = await failTimes(email, attackerIp, PAIR_LIMIT);
  const locked = await client.login(email, password, { ip: attackerIp });
  const wrongElsewhere = await client.login(email, WRONG_PASSWORD, { ip: otherIp });
  return [...failures, locked.code, wrongElsewhere.code];
}

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  limiter = server.app.get(RateLimiter);
});

afterAll(async () => {
  await server.destroy();
});

describe('login throttling (D29)', () => {
  it('locks one account and address pair after ten failures, even for the right password', async () => {
    // Arrange
    const email = await registeredEmail();
    const ip = uniqueIp();

    // Act
    const failures = await failTimes(email, ip, PAIR_LIMIT);
    const eleventh = await client.login(email, PASSWORD, { ip });

    // Assert
    expect(failures).toEqual(Array<string>(PAIR_LIMIT).fill(INVALID));
    expect(eleventh.code).toBe(LIMITED);
    expect(eleventh.retryAfterSeconds).toBeGreaterThanOrEqual(FIRST_LOCKOUT_SECONDS - 1);
    expect(Number(eleventh.retryAfterHeader)).toBeGreaterThanOrEqual(FIRST_LOCKOUT_SECONDS - 1);
  });

  it('lets the correct password in from another address during an attack, with the account limit spent', async () => {
    // Arrange
    const email = await registeredEmail();
    await failTimes(email, uniqueIp(), PAIR_LIMIT);
    const ownerIp = uniqueIp();

    // Act
    const owner = await client.login(email, PASSWORD, { ip: ownerIp });

    // Assert
    expect(owner.code).toBe('OK');
    expect(owner.token).toBeTruthy();
  });

  it('answers a wrong password from another address with RATE_LIMITED and no lockout', async () => {
    // Arrange
    const email = await registeredEmail();
    await failTimes(email, uniqueIp(), PAIR_LIMIT);
    const otherIp = uniqueIp();

    // Act
    const wrong = await client.login(email, WRONG_PASSWORD, { ip: otherIp });
    const right = await client.login(email, PASSWORD, { ip: otherIp });

    // Assert
    expect(wrong.code).toBe(LIMITED);
    expect(right.code).toBe('OK');
    expect((await limiter.isLocked(loginPairKey(emailKeyOf(email), otherIp))).locked).toBe(false);
  });

  it('treats an unknown email exactly like a registered one', async () => {
    // Arrange
    const known = await registeredEmail();
    const unknown = uniqueEmail();

    // Act
    const knownAnswers = await attackSequence(known, PASSWORD);
    const unknownAnswers = await attackSequence(unknown, PASSWORD);

    // Assert
    expect(unknownAnswers).toEqual(knownAnswers);
  });

  it('escalates the lockout by one step when a burst goes far over the limit', async () => {
    // Arrange
    const email = await registeredEmail();
    const ip = uniqueIp();

    // Act
    await failTimes(email, ip, OVER_LIMIT_BURST);
    const lock = await limiter.isLocked(loginPairKey(emailKeyOf(email), ip));

    // Assert
    expect(lock.locked).toBe(true);
    expect(lock.retryAfterSeconds).toBeLessThanOrEqual(FIRST_LOCKOUT_SECONDS);
  });

  it('keeps the email out of every limiter key', async () => {
    // Arrange
    const email = uniqueEmail();
    const consume = vi.spyOn(limiter, 'consume');

    // Act
    await client.login(email, WRONG_PASSWORD, { ip: uniqueIp() });
    const keys = consume.mock.calls.map(([, key]) => key);
    consume.mockRestore();

    // Assert
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => key.includes(email))).toEqual([]);
  });

  it('leaves another account on the same address alone', async () => {
    // Arrange
    const ip = uniqueIp();
    await failTimes(await registeredEmail(), ip, PAIR_LIMIT);
    const other = await registeredEmail();

    // Act
    const answer = await client.login(other, PASSWORD, { ip });

    // Assert
    expect(answer.code).toBe('OK');
  });

  it('limits one address trying many accounts at sixty a minute', async () => {
    // Arrange
    const ip = uniqueIp();
    const attempts = Array.from({ length: IP_BURST }, () => client.login(uniqueEmail(), WRONG_PASSWORD, { ip }));

    // Act
    const answers = await Promise.all(attempts);

    // Assert
    const limited = answers.filter((answer) => answer.code === LIMITED).length;
    const invalid = answers.filter((answer) => answer.code === INVALID).length;
    expect(limited).toBeGreaterThan(0);
    expect(invalid).toBeGreaterThanOrEqual(IP_LIMIT);
    expect(limited + invalid).toBe(IP_BURST);
  });

  it('forgets the lockout history after a successful login', async () => {
    // Arrange: the first lockout has run out, so the next one would double if it were remembered.
    const email = await registeredEmail();
    const ip = uniqueIp();
    const key = loginPairKey(emailKeyOf(email), ip);
    await limiter.lockout(key);
    vi.spyOn(limiter, 'isLocked').mockResolvedValueOnce({ locked: false, retryAfterSeconds: 0 });

    // Act
    const answer = await client.login(email, PASSWORD, { ip });
    const next = await limiter.lockout(key);

    // Assert
    expect(answer.code).toBe('OK');
    expect(next.retryAfterSeconds).toBe(FIRST_LOCKOUT_SECONDS);
  });

  it('uses one bucket for an email in mixed case or with surrounding spaces', async () => {
    // Arrange
    const email = await registeredEmail();
    const ip = uniqueIp();
    await failTimes(`  ${email.toUpperCase()} `, ip, PAIR_LIMIT);

    // Act
    const answer = await client.login(email, PASSWORD, { ip });

    // Assert
    expect(answer.code).toBe(LIMITED);
  });

  it('logs in with an email in mixed case and surrounding spaces', async () => {
    // Arrange
    const email = await registeredEmail();

    // Act
    const answer = await client.login(`  ${email.toUpperCase()} `, PASSWORD, { ip: uniqueIp() });

    // Assert
    expect(answer.code).toBe('OK');
  });

  it('translates the refusal for the caller language', async () => {
    // Arrange
    const email = await registeredEmail();
    const ip = uniqueIp();
    await failTimes(email, ip, PAIR_LIMIT);

    // Act
    const answer = await client.login(email, PASSWORD, { ip, language: 'ar' });

    // Assert
    expect(answer.code).toBe(LIMITED);
    expect(answer.message).toMatch(/[؀-ۿ]/);
  });
});

describe('REST login', () => {
  it('returns the session token header and the user on a correct password', async () => {
    // Arrange
    const email = await registeredEmail();

    // Act
    const response = await client.rest('/auth/login', { username: email, password: PASSWORD }, { ip: uniqueIp() });

    // Assert
    expect(response.status).toBe(200);
    const token = response.headers.get(AUTH_TOKEN_HEADER);
    expect(token).toBeTruthy();
    expect(await client.me({ token: token ?? '' })).toBe(email);
  });

  it('answers 401 for a wrong password', async () => {
    // Arrange
    const email = await registeredEmail();

    // Act
    const response = await client.rest(
      '/auth/login',
      { username: email, password: WRONG_PASSWORD },
      { ip: uniqueIp() },
    );

    // Assert
    expect(response.status).toBe(401);
    expect(response.headers.get(AUTH_TOKEN_HEADER)).toBeNull();
  });

  it('answers 400 for a body without credentials', async () => {
    // Act
    const response = await client.rest('/auth/login', { username: 42 }, { ip: uniqueIp() });

    // Assert
    expect(response.status).toBe(400);
  });

  it('answers 429 with Retry-After when the pair is locked', async () => {
    // Arrange
    const email = await registeredEmail();
    const ip = uniqueIp();
    await failTimes(email, ip, PAIR_LIMIT);

    // Act
    const response = await client.rest('/auth/login', { username: email, password: PASSWORD }, { ip });

    // Assert
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThanOrEqual(FIRST_LOCKOUT_SECONDS - 1);
  });
});
