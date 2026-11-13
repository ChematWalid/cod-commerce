import { ClientIpResolver, RateLimitedError, RateLimiter } from '@cod/plugin-rate-limit';
import {
  type Injector,
  type NativeAuthenticationData,
  NativeAuthenticationStrategy,
  type RequestContext,
  type User,
} from '@vendure/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SECRET_HASHER } from '../../application/tokens';
import { loginEmailKey, loginPairKey } from '../../domain/login-throttle-keys';
import { ThrottledNativeAuthenticationStrategy } from '../../infrastructure/throttled-native-authentication.strategy';
import { FakeSecretHasher } from '../fakes/fake-secret-hasher';
import { InMemoryRateLimiter } from '../fakes/in-memory-rate-limiter';

const EMAIL = 'owner@example.test';
const PASSWORD = 'synthetic-correct-password';
const WRONG_PASSWORD = 'synthetic-wrong-password';
const ATTACKER_IP = '203.0.113.7';
const OWNER_IP = '198.51.100.9';
const PAIR_LIMIT = 10;
/** As many as the per-address limit lets through, so only the pair limit can stop the burst. */
const PARALLEL_BURST = 60;
const USER = { id: 1 } as User;

/** The strategy wired to fakes, with Vendure's own password check replaced by a counting stub. */
interface Harness {
  readonly strategy: ThrottledNativeAuthenticationStrategy;
  readonly limiter: InMemoryRateLimiter;
  readonly pairKey: (ip: string) => string;
  /** How many attempts reached the password check. */
  readonly checks: () => number;
}

async function harness(): Promise<Harness> {
  const limiter = new InMemoryRateLimiter();
  const hasher = new FakeSecretHasher();
  const services = new Map<unknown, unknown>([
    [RateLimiter, limiter],
    [ClientIpResolver, new ClientIpResolver('')],
    [SECRET_HASHER, hasher],
  ]);
  const injector = { get: (token: unknown) => services.get(token) } as unknown as Injector;
  let checks = 0;
  vi.spyOn(NativeAuthenticationStrategy.prototype, 'authenticate').mockImplementation(async (_ctx, data) => {
    checks += 1;
    // A real check hashes for a while, so parallel attempts overlap here.
    await new Promise((resolve) => setImmediate(resolve));
    return data.password === PASSWORD ? USER : false;
  });
  const strategy = new ThrottledNativeAuthenticationStrategy();
  await strategy.init(injector);
  const emailKey = loginEmailKey(hasher, EMAIL);
  return { strategy, limiter, pairKey: (ip) => loginPairKey(emailKey, ip), checks: () => checks };
}

const contextFrom = (ip: string): RequestContext => ({ req: { ip, headers: {} } }) as unknown as RequestContext;
const credentials = (password: string): NativeAuthenticationData => ({ username: EMAIL, password });

async function failSequentially(strategy: ThrottledNativeAuthenticationStrategy, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await strategy.authenticate(contextFrom(ATTACKER_IP), credentials(WRONG_PASSWORD));
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ThrottledNativeAuthenticationStrategy pair limit (D29, RL-1)', () => {
  it('lets sixty parallel wrong logins of one pair reach the password check at most ten times', async () => {
    // Arrange
    const { strategy, limiter, checks } = await harness();

    // Act
    const answers = await Promise.allSettled(
      Array.from({ length: PARALLEL_BURST }, () =>
        strategy.authenticate(contextFrom(ATTACKER_IP), credentials(WRONG_PASSWORD)),
      ),
    );

    // Assert
    expect(checks()).toBeLessThanOrEqual(PAIR_LIMIT);
    expect(answers.filter((answer) => answer.status === 'fulfilled')).toHaveLength(PAIR_LIMIT);
    expect(limiter.lockouts).toHaveLength(1);
  });

  it('lets the correct password in on the tenth attempt without locking the pair', async () => {
    // Arrange
    const { strategy, limiter, pairKey } = await harness();
    await failSequentially(strategy, PAIR_LIMIT - 1);

    // Act
    const user = await strategy.authenticate(contextFrom(ATTACKER_IP), credentials(PASSWORD));

    // Assert
    expect(user).toBe(USER);
    expect(limiter.lockouts).toEqual([]);
    expect((await limiter.isLocked(pairKey(ATTACKER_IP))).locked).toBe(false);
  });

  it('gives the pair token back on a correct password, so it does not count as a failure', async () => {
    // Arrange
    const { strategy, limiter, pairKey } = await harness();
    await failSequentially(strategy, PAIR_LIMIT - 1);

    // Act
    await strategy.authenticate(contextFrom(ATTACKER_IP), credentials(PASSWORD));

    // Assert
    expect(limiter.remaining('login-pair', pairKey(ATTACKER_IP))).toBe(1);
  });

  it('refuses a locked pair without checking the password and without locking it again', async () => {
    // Arrange
    const { strategy, limiter, checks } = await harness();
    await failSequentially(strategy, PAIR_LIMIT);

    // Act
    const answer = strategy.authenticate(contextFrom(ATTACKER_IP), credentials(PASSWORD));

    // Assert
    await expect(answer).rejects.toBeInstanceOf(RateLimitedError);
    expect(checks()).toBe(PAIR_LIMIT);
    expect(limiter.lockouts).toHaveLength(1);
  });

  it('lets the correct password in from another address while the account limit is spent', async () => {
    // Arrange
    const { strategy } = await harness();
    await failSequentially(strategy, PAIR_LIMIT);

    // Act
    const user = await strategy.authenticate(contextFrom(OWNER_IP), credentials(PASSWORD));

    // Assert
    expect(user).toBe(USER);
  });
});
