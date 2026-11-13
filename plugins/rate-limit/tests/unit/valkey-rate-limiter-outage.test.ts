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

describe('ValkeyRateLimiter refunds during an outage', () => {
  it('gives the token back in memory while Valkey is unreachable', async () => {
    // Arrange: login-pair keeps limiting from memory, 10 per minute
    const { limiter, redis } = harness();
    redis.failing = true;
    for (let i = 0; i < 10; i += 1) {
      await limiter.consume('login-pair', KEY);
    }

    // Act
    await limiter.refund('login-pair', KEY);
    const afterRefund = await limiter.consume('login-pair', KEY);
    const next = await limiter.consume('login-pair', KEY);

    // Assert
    expect(afterRefund.allowed).toBe(true);
    expect(next.allowed).toBe(false);
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

  it('asks Valkey for a lockout another process set even inside the outage window', async () => {
    // Arrange
    const { limiter, redis } = harness();
    const other = new ValkeyRateLimiter(redis.asClient(), { logger: { error: () => undefined }, now: () => 0 });
    await other.lockout(KEY);
    redis.failing = true;
    await limiter.consume('login-pair', KEY);
    redis.failing = false;

    // Act
    const status = await limiter.isLocked(KEY);

    // Assert
    expect(status.locked).toBe(true);
  });

  it('keeps doubling from the last lockout Valkey reported during an outage', async () => {
    // Arrange
    const { limiter, redis } = harness();
    await limiter.lockout(KEY);
    redis.failing = true;

    // Act
    const duringOutage = await limiter.lockout(KEY);

    // Assert
    expect(duringOutage.retryAfterSeconds).toBe(120);
  });

  it('replays in Valkey a clear made during an outage', async () => {
    // Arrange
    const { limiter, redis, clock } = harness();
    await limiter.lockout(KEY);
    redis.failing = true;
    await limiter.clearLockout(KEY);
    redis.failing = false;

    // Act
    clock.advanceSeconds(OUTAGE_RETRY_MS / 1000);
    const status = await limiter.isLocked(KEY);

    // Assert
    expect(status.locked).toBe(false);
    expect(await redis.pttl(LOCK_KEY)).toBe(-2);
  });

  it('does not resurrect, during an outage, a lockout another process cleared', async () => {
    // Arrange
    const { limiter, redis } = harness();
    await limiter.lockout(KEY);
    redis.forget(LOCK_KEY);
    await limiter.isLocked(KEY);

    // Act
    redis.failing = true;
    const status = await limiter.isLocked(KEY);

    // Assert
    expect(status.locked).toBe(false);
  });
});
