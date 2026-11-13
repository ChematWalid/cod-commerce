import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type LimiterRedis, createLimiterRedis, ValkeyRateLimiter } from '../../infrastructure/valkey-rate-limiter';
import { describeLimiterContract } from '../fakes/limiter-contract';
import { ManualClock } from '../fakes/manual-clock';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

/** The client has no offline queue, so a command sent before the connection is ready would fail. */
const redis: LimiterRedis = createLimiterRedis(TEST_REDIS_URL);

beforeAll(async () => {
  // Every test builds a limiter on this one client, and each limiter listens for its errors.
  redis.setMaxListeners(0);
  await new ValkeyRateLimiter(redis, { logger: { error: () => undefined } }).onApplicationBootstrap();
});

afterAll(async () => {
  await redis.quit();
});

const limiterOn = (clock: ManualClock): ValkeyRateLimiter =>
  new ValkeyRateLimiter(redis, { logger: { error: () => undefined }, now: clock.now, bucketClock: clock.now });

describeLimiterContract('ValkeyRateLimiter', () => {
  const clock = new ManualClock();
  return { clock, uniqueKey: () => `test-${randomUUID()}`, limiter: limiterOn(clock) };
});

describe('ValkeyRateLimiter storage', () => {
  it('stores each bucket under rl:{policy}:{key} with a TTL, so idle keys disappear', async () => {
    // Arrange
    const clock = new ManualClock();
    const limiter = limiterOn(clock);
    const key = `test-${randomUUID()}`;

    // Act
    await limiter.consume('login-ip', key);
    const ttl = await redis.pttl(`rl:login-ip:${key}`);

    // Assert
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60_000);
  });

  it('never lets concurrent requests take more tokens than the bucket holds', async () => {
    // Arrange
    const clock = new ManualClock();
    const limiter = limiterOn(clock);
    const key = `test-${randomUUID()}`;

    // Act
    const decisions = await Promise.all(Array.from({ length: 100 }, () => limiter.consume('login-pair', key)));

    // Assert
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(10);
  });
});

describe('ValkeyRateLimiter clock (RL-5)', () => {
  const DAY_MS = 86_400_000;
  const SUBDOMAIN_IP_CAPACITY = 60;

  it('does not let a stamp a day in the future freeze refill', async () => {
    // Arrange: one token per second under subdomain-ip
    const key = `test-${randomUUID()}`;
    const ahead = new ValkeyRateLimiter(redis, {
      logger: { error: () => undefined },
      bucketClock: () => Date.now() + DAY_MS,
    });
    for (let i = 0; i < SUBDOMAIN_IP_CAPACITY; i += 1) {
      await ahead.consume('subdomain-ip', key);
    }
    const onValkeyTime = new ValkeyRateLimiter(redis, { logger: { error: () => undefined } });

    // Act: the first call at real time finds the future stamp; one second later a token is back
    const first = await onValkeyTime.consume('subdomain-ip', key);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const second = await onValkeyTime.consume('subdomain-ip', key);

    // Assert
    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(true);
  });

  it('stamps the bucket with Valkey time, not the api process clock', async () => {
    // Arrange
    const key = `test-${randomUUID()}`;
    const limiter = new ValkeyRateLimiter(redis, { logger: { error: () => undefined }, now: () => 0 });
    const [seconds] = await redis.time();

    // Act
    await limiter.consume('login-ip', key);
    const stamp = Number(await redis.hget(`rl:login-ip:${key}`, 'u'));

    // Assert
    expect(Math.abs(stamp - Number(seconds) * 1000)).toBeLessThan(5000);
  });
});

describe('ValkeyRateLimiter otp-account-daily', () => {
  const OTP_DAILY_CAPACITY = 50;

  it('allows 50 code checks a day and then waits for a token, about half an hour', async () => {
    // Arrange
    const clock = new ManualClock();
    const limiter = limiterOn(clock);
    const key = `test-${randomUUID()}`;

    // Act
    const decisions = [];
    for (let i = 0; i <= OTP_DAILY_CAPACITY; i += 1) {
      decisions.push(await limiter.consume('otp-account-daily', key));
    }

    // Assert: 50 per 86 400 s refills one token every 1728 s
    expect(decisions.slice(0, OTP_DAILY_CAPACITY).every((decision) => decision.allowed)).toBe(true);
    expect(decisions[OTP_DAILY_CAPACITY]).toEqual({ allowed: false, retryAfterSeconds: 1728, exhausted: true });
    expect(await redis.pttl(`rl:otp-account-daily:${key}`)).toBeGreaterThan(86_000_000);
  });
});
