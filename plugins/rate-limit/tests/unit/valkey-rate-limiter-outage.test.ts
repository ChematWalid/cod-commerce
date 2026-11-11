import { describe, expect, it } from 'vitest';
import { OUTAGE_RETRY_MS, ValkeyRateLimiter } from '../../infrastructure/valkey-rate-limiter';
import { ManualClock } from '../fakes/manual-clock';
import { ScriptedRedis } from '../fakes/scripted-redis';

const KEY = 'pair:alice@example.test:203.0.113.5';
const LOCK_KEY = `rl:lockout:${KEY}`;

function harness(): { limiter: ValkeyRateLimiter; redis: ScriptedRedis; clock: ManualClock } {
  const clock = new ManualClock();
  const redis = new ScriptedRedis(clock.now);
  const limiter = new ValkeyRateLimiter(redis.asClient(), { logger: { error: () => undefined }, now: clock.now });
  return { limiter, redis, clock };
}

describe('ValkeyRateLimiter outage breaker', () => {
  it('does not touch Valkey again inside the retry window after one error', async () => {
    // Arrange
    const { limiter, redis } = harness();
    redis.failing = true;
    await limiter.consume('login-pair', KEY);
    const afterFailure = redis.commands;

    // Act
    redis.failing = false;
    await limiter.consume('login-pair', KEY);

    // Assert
    expect(afterFailure).toBe(1);
    expect(redis.commands).toBe(1);
  });

  it('goes back to Valkey once the retry window has passed', async () => {
    // Arrange
    const { limiter, redis, clock } = harness();
    redis.failing = true;
    await limiter.consume('login-pair', KEY);
    redis.failing = false;

    // Act
    clock.advanceSeconds(OUTAGE_RETRY_MS / 1000);
    await limiter.consume('login-pair', KEY);

    // Assert
    expect(redis.commands).toBe(2);
  });
});

describe('ValkeyRateLimiter lockouts across the switch', () => {
  it('still honours a lockout set in Valkey after one Valkey error', async () => {
    // Arrange
    const { limiter, redis } = harness();
    await limiter.lockout(KEY);

    // Act
    redis.failing = true;
    const status = await limiter.isLocked(KEY);

    // Assert
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBe(60);
  });

  it('still honours a lockout another process set, once this process has read it', async () => {
    // Arrange
    const { limiter, redis } = harness();
    const other = new ValkeyRateLimiter(redis.asClient(), { logger: { error: () => undefined }, now: () => 0 });
    await other.lockout(KEY);
    await limiter.isLocked(KEY);

    // Act
    redis.failing = true;
    const status = await limiter.isLocked(KEY);

    // Assert
    expect(status.locked).toBe(true);
  });

  it('still honours a lockout set in memory during the outage once Valkey is back', async () => {
    // Arrange
    const { limiter, redis, clock } = harness();
    redis.failing = true;
    await limiter.lockout(KEY);
    redis.failing = false;

    // Act
    clock.advanceSeconds(OUTAGE_RETRY_MS / 1000);
    const status = await limiter.isLocked(KEY);

    // Assert
    expect(redis.commands).toBe(2);
    expect(status.locked).toBe(true);
  });

  it('lifts a lockout another process cleared in Valkey while Valkey answers', async () => {
    // Arrange
    const { limiter, redis } = harness();
    await limiter.lockout(KEY);

    // Act
    redis.forget(LOCK_KEY);
    const status = await limiter.isLocked(KEY);

    // Assert
    expect(status.locked).toBe(false);
  });

  it('forgets both copies when the key is cleared', async () => {
    // Arrange
    const { limiter, redis } = harness();
    await limiter.lockout(KEY);
    await limiter.clearLockout(KEY);

    // Act
    redis.failing = true;
    const status = await limiter.isLocked(KEY);

    // Assert
    expect(status.locked).toBe(false);
  });
});
