import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  KEY_PREFIX,
  LOCKOUT_GROWTH_FACTOR,
  LOCKOUT_INITIAL_SECONDS,
  LOCKOUT_MAX_SECONDS,
  LOCKOUT_MEMORY_SECONDS,
  MS_PER_SECOND,
} from '../domain/constants';
import { ALLOWED, type LockoutStatus, NOT_LOCKED, type RateLimitDecision } from '../domain/decision';
import { RATE_LIMIT_POLICIES, type RateLimitPolicyName } from '../domain/policies';
import { RateLimiter } from '../domain/rate-limiter';
import { InProcessBucket } from './in-process-bucket';
import { LOCKOUT_SCRIPT, REFUND_SCRIPT, TOKEN_BUCKET_SCRIPT } from './limiter-scripts';

/** How long a Valkey command may take before the limiter gives up on it (D31). */
export const COMMAND_TIMEOUT_MS = 250;
/** After a failure Valkey is not asked again for this long, so an outage does not add a timeout to every request. */
export const OUTAGE_RETRY_MS = 2000;
/** The most often the same outage is logged. */
export const LOG_INTERVAL_MS = 30_000;
/** How long boot waits for the first connection before carrying on without one. */
export const STARTUP_WAIT_MS = 1000;

const LOCK_PREFIX = `${KEY_PREFIX}:lockout`;
const RESPECT_BREAKER = 'respect';
const IGNORE_BREAKER = 'ignore';
/** Whether a Valkey call is skipped inside the outage window, or tried anyway. */
type BreakerUse = typeof RESPECT_BREAKER | typeof IGNORE_BREAKER;
const LOCK_LEVEL_PREFIX = `${KEY_PREFIX}:lockout-level`;
const PTTL_NO_KEY = -2;
const NO_EXPIRY = -1;

/** The custom commands {@link createLimiterRedis} defines on the client. */
export interface LimiterRedis extends Redis {
  rlTokenBucket(key: string, capacity: number, windowMs: number, nowMs?: number): Promise<[number, number, number]>;
  rlRefund(key: string, capacity: number, windowMs: number, nowMs?: number): Promise<number>;
  rlLockout(
    lockKey: string,
    levelKey: string,
    initial: number,
    max: number,
    memory: number,
    growth: number,
  ): Promise<number>;
}

/** Where the limiter reports faults; Vendure's logger in production. */
export interface RateLimitLogger {
  error(message: string): void;
}

/** Options of {@link ValkeyRateLimiter}; all default to the production values. */
export interface ValkeyRateLimiterOptions {
  readonly logger: RateLimitLogger;
  readonly now?: () => number;
  /**
   * Tests only: the clock the token-bucket script reads instead of Valkey's `TIME`. Production leaves it unset,
   * so every api process refills by the same clock (RL-5).
   */
  readonly bucketClock?: () => number;
  readonly fallback?: InProcessBucket;
}

/**
 * A client that fails fast instead of hanging a request (D31): no offline queue, so a command sent while the
 * socket is down is rejected at once, and a command timeout, so a socket that stops answering is too.
 */
export function createLimiterRedis(url: string): LimiterRedis {
  const redis = new Redis(url, {
    enableOfflineQueue: false,
    commandTimeout: COMMAND_TIMEOUT_MS,
    maxRetriesPerRequest: 0,
    connectionName: 'rate-limit',
  });
  redis.defineCommand('rlTokenBucket', { numberOfKeys: 1, lua: TOKEN_BUCKET_SCRIPT });
  redis.defineCommand('rlRefund', { numberOfKeys: 1, lua: REFUND_SCRIPT });
  redis.defineCommand('rlLockout', { numberOfKeys: 2, lua: LOCKOUT_SCRIPT });
  return redis as LimiterRedis;
}

/**
 * Token buckets and lockouts in Valkey, one atomic script per decision. While Valkey is unreachable each policy
 * does what it declares (D31): `in-process` policies keep limiting from memory, `open` ones allow. Every
 * failure is logged (rate-limited), and Valkey is retried every {@link OUTAGE_RETRY_MS}.
 *
 * Lockouts survive the switch both ways on this process (RL-2). Every lockout Valkey reports is mirrored in
 * memory and honoured from there while Valkey is unreachable. A lockout made in memory during an outage is
 * still honoured once Valkey is back, until it ends or the key is cleared, and keeps doubling from the last
 * length Valkey reported. Lockout checks ask Valkey even inside the outage window. While Valkey answers, the
 * mirror is not read, so a lockout cleared by another process (a correct login there) is cleared here too.
 * A clear made during an outage is replayed in Valkey once it answers.
 */
export class ValkeyRateLimiter extends RateLimiter implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly now: () => number;
  private readonly fallback: InProcessBucket;
  /** Lockouts Valkey reported, read only while Valkey is unreachable. */
  private readonly valkeyLockouts: InProcessBucket;
  /** Keys cleared while Valkey was unreachable, still to delete there. */
  private readonly pendingClears = new Set<string>();
  private retryValkeyAtMs = 0;
  private lastLoggedAtMs = Number.NEGATIVE_INFINITY;
  private suppressedErrors = 0;

  constructor(
    private readonly redis: LimiterRedis,
    private readonly options: ValkeyRateLimiterOptions,
  ) {
    super();
    this.now = options.now ?? Date.now;
    this.fallback = options.fallback ?? new InProcessBucket(this.now);
    this.valkeyLockouts = new InProcessBucket(this.now);
    redis.on('error', (error: Error) => {
      this.report(error);
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.redis.status === 'ready') {
      return;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, STARTUP_WAIT_MS);
      this.redis.once('ready', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch((error: unknown) => {
      // Said directly: `report` would drop it as a repeat of an outage message, and it is not an outage.
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.options.logger.error(`Valkey connection did not close cleanly on shutdown; forcing it closed: ${reason}`);
      this.redis.disconnect();
    });
  }

  async consume(policy: RateLimitPolicyName, key: string): Promise<RateLimitDecision> {
    const fromValkey = await this.viaValkey(async () => {
      const [allowed, retryAfterSeconds, exhausted] = await this.redis.rlTokenBucket(...this.bucketArgs(policy, key));
      return { allowed: allowed === 1, retryAfterSeconds, exhausted: exhausted === 1 };
    });
    if (fromValkey !== undefined) {
      return fromValkey;
    }
    return RATE_LIMIT_POLICIES[policy].outage === 'in-process' ? this.fallback.consume(policy, key) : ALLOWED;
  }

  /**
   * Puts one token back, atomically and never above capacity. While Valkey is unreachable an `in-process`
   * policy gives it back in memory: a token taken in Valkey just before the outage is then returned to a
   * bucket that may still be full, so the refund is lost, which errs on the side of limiting.
   */
  async refund(policy: RateLimitPolicyName, key: string): Promise<void> {
    const refunded = await this.viaValkey(() => this.redis.rlRefund(...this.bucketArgs(policy, key)));
    if (refunded === undefined && RATE_LIMIT_POLICIES[policy].outage === 'in-process') {
      this.fallback.refund(policy, key);
    }
  }

  /** The bucket script arguments: key, capacity, window in ms and, in tests only, the clock. */
  private bucketArgs(policy: RateLimitPolicyName, key: string): [string, number, number, ...number[]] {
    const definition = RATE_LIMIT_POLICIES[policy];
    return [
      `${KEY_PREFIX}:${policy}:${key}`,
      definition.capacity,
      definition.windowSeconds * MS_PER_SECOND,
      ...(this.options.bucketClock === undefined ? [] : [this.options.bucketClock()]),
    ];
  }

  async lockout(key: string): Promise<LockoutStatus> {
    const seconds = await this.viaValkey(() =>
      this.redis.rlLockout(
        `${LOCK_PREFIX}:${key}`,
        `${LOCK_LEVEL_PREFIX}:${key}`,
        LOCKOUT_INITIAL_SECONDS,
        LOCKOUT_MAX_SECONDS,
        LOCKOUT_MEMORY_SECONDS,
        LOCKOUT_GROWTH_FACTOR,
      ),
    );
    if (seconds === undefined) {
      // Keep doubling from the last lockout Valkey reported, not from 60 s.
      return this.fallback.lockout(key, this.valkeyLockouts.lastLockoutSeconds(key));
    }
    this.valkeyLockouts.holdLockout(key, seconds);
    return { locked: true, retryAfterSeconds: seconds };
  }

  /**
   * Locked when Valkey holds a lockout, or when one was made in memory during an outage; while Valkey is
   * unreachable, the lockouts it last reported count too. The longer wait wins.
   */
  async isLocked(key: string): Promise<LockoutStatus> {
    await this.replayPendingClears();
    const fromValkey = (await this.lockoutInValkey(key)) ?? this.valkeyLockouts.isLocked(key);
    const fromOutage = this.fallback.isLocked(key);
    return fromOutage.retryAfterSeconds > fromValkey.retryAfterSeconds ? fromOutage : fromValkey;
  }

  /**
   * The lockout Valkey holds for `key`, mirrored into memory; `undefined` when Valkey is unavailable. It asks
   * Valkey even inside the outage window: a lockout another process set must not lapse for 2 s after one
   * failed call here (RL-2). The cost is bounded: with no offline queue, a call to a down Valkey fails at once,
   * and a hung one within the command timeout.
   */
  private async lockoutInValkey(key: string): Promise<LockoutStatus | undefined> {
    const remainingMs = await this.viaValkey(() => this.redis.pttl(`${LOCK_PREFIX}:${key}`), IGNORE_BREAKER);
    if (remainingMs === undefined) {
      return undefined;
    }
    if (remainingMs === PTTL_NO_KEY || remainingMs === NO_EXPIRY) {
      this.valkeyLockouts.clearLockout(key);
      return NOT_LOCKED;
    }
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / MS_PER_SECOND));
    this.valkeyLockouts.holdLockout(key, retryAfterSeconds);
    return { locked: true, retryAfterSeconds };
  }

  /** Forgets the key everywhere; a clear Valkey could not take is replayed once it answers again. */
  async clearLockout(key: string): Promise<void> {
    this.fallback.clearLockout(key);
    this.valkeyLockouts.clearLockout(key);
    this.pendingClears.add(key);
    await this.replayPendingClears();
  }

  /** Deletes, in Valkey, the lockouts cleared while it was unreachable; stops at the first failure. */
  private async replayPendingClears(): Promise<void> {
    for (const key of this.pendingClears) {
      const deleted = await this.viaValkey(() =>
        this.redis.del(`${LOCK_PREFIX}:${key}`, `${LOCK_LEVEL_PREFIX}:${key}`),
      );
      if (deleted === undefined) {
        return;
      }
      this.pendingClears.delete(key);
    }
  }

  /** Runs `command`; `undefined` means Valkey is unavailable and the caller must use its fallback. */
  private async viaValkey<T>(command: () => Promise<T>, breaker: BreakerUse = RESPECT_BREAKER): Promise<T | undefined> {
    if (breaker === RESPECT_BREAKER && this.now() < this.retryValkeyAtMs) {
      return undefined;
    }
    try {
      return await command();
    } catch (error: unknown) {
      this.retryValkeyAtMs = this.now() + OUTAGE_RETRY_MS;
      this.report(error);
      // A socket that stopped answering still reads as connected; reconnecting replaces it.
      if (this.redis.status === 'ready') {
        this.redis.disconnect(true);
      }
      return undefined;
    }
  }

  private report(error: unknown): void {
    const nowMs = this.now();
    if (nowMs - this.lastLoggedAtMs < LOG_INTERVAL_MS) {
      this.suppressedErrors += 1;
      return;
    }
    const reason = error instanceof Error ? error.message : 'unknown error';
    const repeated =
      this.suppressedErrors === 0 ? '' : ` (${String(this.suppressedErrors)} more since the last report)`;
    this.lastLoggedAtMs = nowMs;
    this.suppressedErrors = 0;
    this.options.logger.error(
      `Valkey unavailable, limiting from memory or failing open per policy: ${reason}${repeated}`,
    );
  }
}
