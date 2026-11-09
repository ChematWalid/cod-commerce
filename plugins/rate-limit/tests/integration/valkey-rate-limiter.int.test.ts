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
  new ValkeyRateLimiter(redis, { logger: { error: () => undefined }, now: clock.now });

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
