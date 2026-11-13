import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_POLICIES } from '../../domain/policies';
import type { RateLimiter } from '../../domain/rate-limiter';
import type { ManualClock } from './manual-clock';

/** What a limiter under test needs to be driven: a fresh instance per test, and the clock it reads. */
export interface LimiterHarness {
  readonly limiter: RateLimiter;
  readonly clock: ManualClock;
  /** A key no earlier test used, so shared storage does not leak between tests. */
  readonly uniqueKey: () => string;
}

const LOGIN_PAIR = RATE_LIMIT_POLICIES['login-pair'];
const SUBDOMAIN_IP = RATE_LIMIT_POLICIES['subdomain-ip'];
const LOCKOUT_SERIES = [60, 120, 240, 480, 960, 1920, 3600, 3600];

/** The behaviour every {@link RateLimiter} implementation shares: buckets and lockouts. */
export function describeLimiterContract(name: string, create: () => LimiterHarness): void {
  describe(`${name}: buckets`, () => {
    it('allows a full bucket then denies with the time until one token is back', async () => {
      // Arrange
      const { limiter, uniqueKey } = create();
      const key = uniqueKey();

      // Act
      const decisions = [];
      for (let i = 0; i <= LOGIN_PAIR.capacity; i += 1) {
        decisions.push(await limiter.consume('login-pair', key));
      }

      // Assert: 10 per minute refills one token every 6 s
      expect(decisions.slice(0, LOGIN_PAIR.capacity).every((decision) => decision.allowed)).toBe(true);
      expect(decisions[LOGIN_PAIR.capacity]).toEqual({ allowed: false, retryAfterSeconds: 6, exhausted: true });
    });

    it('reports the call that takes the last token as exhausted, and no earlier one', async () => {
      // Arrange
      const { limiter, uniqueKey } = create();
      const key = uniqueKey();

      // Act
      const decisions = [];
      for (let i = 0; i < LOGIN_PAIR.capacity; i += 1) {
        decisions.push(await limiter.consume('login-pair', key));
      }

      // Assert
      expect(decisions.map((decision) => decision.exhausted)).toEqual([
        ...Array<boolean>(LOGIN_PAIR.capacity - 1).fill(false),
        true,
      ]);
    });

    it('reports a shorter wait as the clock advances', async () => {
      // Arrange
      const { limiter, clock, uniqueKey } = create();
      const key = uniqueKey();
      for (let i = 0; i < LOGIN_PAIR.capacity; i += 1) {
        await limiter.consume('login-pair', key);
      }

      // Act
      clock.advanceSeconds(4);
      const decision = await limiter.consume('login-pair', key);

      // Assert
      expect(decision).toEqual({ allowed: false, retryAfterSeconds: 2, exhausted: true });
    });

    it('refills after the window', async () => {
      // Arrange
      const { limiter, clock, uniqueKey } = create();
      const key = uniqueKey();
      for (let i = 0; i <= LOGIN_PAIR.capacity; i += 1) {
        await limiter.consume('login-pair', key);
      }

      // Act
      clock.advanceSeconds(LOGIN_PAIR.windowSeconds);
      const decisions = await Promise.all(
        Array.from({ length: LOGIN_PAIR.capacity }, () => limiter.consume('login-pair', key)),
      );

      // Assert
      expect(decisions.every((decision) => decision.allowed)).toBe(true);
      expect((await limiter.consume('login-pair', key)).allowed).toBe(false);
    });

    it('allows one request per refill interval after the bucket drained', async () => {
      // Arrange
      const { limiter, clock, uniqueKey } = create();
      const key = uniqueKey();
      for (let i = 0; i < SUBDOMAIN_IP.capacity; i += 1) {
        await limiter.consume('subdomain-ip', key);
      }

      // Act
      clock.advanceSeconds(1);
      const afterOneSecond = await limiter.consume('subdomain-ip', key);
      const immediately = await limiter.consume('subdomain-ip', key);

      // Assert
      expect(afterOneSecond.allowed).toBe(true);
      expect(immediately).toEqual({ allowed: false, retryAfterSeconds: 1, exhausted: true });
    });

    it('keeps policies and keys apart', async () => {
      // Arrange
      const { limiter, uniqueKey } = create();
      const key = uniqueKey();
      for (let i = 0; i < LOGIN_PAIR.capacity; i += 1) {
        await limiter.consume('login-pair', key);
      }

      // Act
      const otherPolicy = await limiter.consume('login-account', key);
      const otherKey = await limiter.consume('login-pair', uniqueKey());

      // Assert
      expect(otherPolicy.allowed).toBe(true);
      expect(otherKey.allowed).toBe(true);
    });
  });

  describe(`${name}: refunds`, () => {
    /** Takes `times` tokens of `key` under login-pair, one after the other. */
    async function take(limiter: RateLimiter, key: string, times: number): Promise<boolean[]> {
      const allowed = [];
      for (let i = 0; i < times; i += 1) {
        allowed.push((await limiter.consume('login-pair', key)).allowed);
      }
      return allowed;
    }

    it('gives a taken token back, so the next request on a drained bucket is allowed', async () => {
      // Arrange
      const { limiter, uniqueKey } = create();
      const key = uniqueKey();
      await take(limiter, key, LOGIN_PAIR.capacity);

      // Act
      await limiter.refund('login-pair', key);
      const afterRefund = await limiter.consume('login-pair', key);

      // Assert
      expect(afterRefund).toEqual({ allowed: true, retryAfterSeconds: 0, exhausted: true });
    });

    it('never fills a bucket above its capacity', async () => {
      // Arrange
      const { limiter, uniqueKey } = create();
      const key = uniqueKey();
      await take(limiter, key, 1);

      // Act
      await limiter.refund('login-pair', key);
      await limiter.refund('login-pair', key);
      const allowed = await take(limiter, key, LOGIN_PAIR.capacity + 1);

      // Assert
      expect(allowed).toEqual([...Array<boolean>(LOGIN_PAIR.capacity).fill(true), false]);
    });

    it('leaves an untouched bucket full', async () => {
      // Arrange
      const { limiter, uniqueKey } = create();
      const key = uniqueKey();

      // Act
      await limiter.refund('login-pair', key);
      const allowed = await take(limiter, key, LOGIN_PAIR.capacity + 1);

      // Assert
      expect(allowed).toEqual([...Array<boolean>(LOGIN_PAIR.capacity).fill(true), false]);
    });

    it('keeps the refill earned before the refund', async () => {
      // Arrange: 10 per minute refills one token every 6 s
      const { limiter, clock, uniqueKey } = create();
      const key = uniqueKey();
      await take(limiter, key, LOGIN_PAIR.capacity);
      clock.advanceSeconds(LOGIN_PAIR.windowSeconds / LOGIN_PAIR.capacity);

      // Act
      await limiter.refund('login-pair', key);
      const allowed = await take(limiter, key, 3);

      // Assert
      expect(allowed).toEqual([true, true, false]);
    });
  });

  describe(`${name}: lockouts`, () => {
    it('doubles from 60 s and caps at 3600 s', async () => {
      // Arrange
      const { limiter, uniqueKey } = create();
      const key = uniqueKey();

      // Act
      const durations = [];
      for (let i = 0; i < LOCKOUT_SERIES.length; i += 1) {
        durations.push((await limiter.lockout(key)).retryAfterSeconds);
      }

      // Assert
      expect(durations).toEqual(LOCKOUT_SERIES);
    });

    it('reports a locked key with the time left, and an untouched key as free', async () => {
      // Arrange
      const { limiter, uniqueKey } = create();
      const key = uniqueKey();
      await limiter.lockout(key);

      // Act
      const locked = await limiter.isLocked(key);
      const free = await limiter.isLocked(uniqueKey());

      // Assert
      expect(locked.locked).toBe(true);
      expect(locked.retryAfterSeconds).toBeGreaterThan(0);
      expect(locked.retryAfterSeconds).toBeLessThanOrEqual(60);
      expect(free).toEqual({ locked: false, retryAfterSeconds: 0 });
    });

    it('forgets a key and its history when cleared', async () => {
      // Arrange
      const { limiter, uniqueKey } = create();
      const key = uniqueKey();
      await limiter.lockout(key);
      await limiter.lockout(key);

      // Act
      await limiter.clearLockout(key);

      // Assert
      expect((await limiter.isLocked(key)).locked).toBe(false);
      expect((await limiter.lockout(key)).retryAfterSeconds).toBe(60);
    });
  });
}
