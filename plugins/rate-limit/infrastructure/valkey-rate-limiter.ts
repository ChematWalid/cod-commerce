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
import { LOCKOUT_SCRIPT, TOKEN_BUCKET_SCRIPT } from './limiter-scripts';

/** How long a Valkey command may take before the limiter gives up on it (D31). */
export const COMMAND_TIMEOUT_MS = 250;
/** After a failure Valkey is not asked again for this long, so an outage does not add a timeout to every request. */
export const OUTAGE_RETRY_MS = 2000;
/** The most often the same outage is logged. */
export const LOG_INTERVAL_MS = 30_000;
/** How long boot waits for the first connection before carrying on without one. */
export const STARTUP_WAIT_MS = 1000;

const LOCK_PREFIX = `${KEY_PREFIX}:lockout`;
const LOCK_LEVEL_PREFIX = `${KEY_PREFIX}:lockout-level`;
const PTTL_NO_KEY = -2;
const NO_EXPIRY = -1;

/** The custom commands {@link createLimiterRedis} defines on the client. */
export interface LimiterRedis extends Redis {
  rlTokenBucket(key: string, capacity: number, windowMs: number, nowMs: number): Promise<[number, number, number]>;
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
  redis.defineCommand('rlLockout', { numberOfKeys: 2, lua: LOCKOUT_SCRIPT });
  return redis as LimiterRedis;
}

/**
 * Token buckets and lockouts in Valkey, one atomic script per decision. While Valkey is unreachable each policy
 * does what it declares (D31): `in-process` policies keep limiting from memory, `open` ones allow. Every
 * failure is logged (rate-limited), and Valkey is retried every {@link OUTAGE_RETRY_MS}.
 */
export class ValkeyRateLimiter extends RateLimiter implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly now: () => number;
  private readonly fallback: InProcessBucket;
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
      this.report(error);
      this.redis.disconnect();
    });
  }

  async consume(policy: RateLimitPolicyName, key: string): Promise<RateLimitDecision> {
    const definition = RATE_LIMIT_POLICIES[policy];
    const fromValkey = await this.viaValkey(async () => {
      const [allowed, retryAfterSeconds, exhausted] = await this.redis.rlTokenBucket(
        `${KEY_PREFIX}:${policy}:${key}`,
        definition.capacity,
        definition.windowSeconds * MS_PER_SECOND,
        this.now(),
      );
      return { allowed: allowed === 1, retryAfterSeconds, exhausted: exhausted === 1 };
    });
    if (fromValkey !== undefined) {
      return fromValkey;
    }
    return definition.outage === 'in-process' ? this.fallback.consume(policy, key) : ALLOWED;
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
    return seconds === undefined ? this.fallback.lockout(key) : { locked: true, retryAfterSeconds: seconds };
  }

  async isLocked(key: string): Promise<LockoutStatus> {
    const remainingMs = await this.viaValkey(() => this.redis.pttl(`${LOCK_PREFIX}:${key}`));
    if (remainingMs === undefined) {
      return this.fallback.isLocked(key);
    }
    if (remainingMs === PTTL_NO_KEY || remainingMs === NO_EXPIRY) {
      return NOT_LOCKED;
    }
    return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / MS_PER_SECOND)) };
  }

  async clearLockout(key: string): Promise<void> {
    this.fallback.clearLockout(key);
    await this.viaValkey(() => this.redis.del(`${LOCK_PREFIX}:${key}`, `${LOCK_LEVEL_PREFIX}:${key}`));
  }

  /** Runs `command`; `undefined` means Valkey is unavailable and the caller must use its fallback. */
  private async viaValkey<T>(command: () => Promise<T>): Promise<T | undefined> {
    if (this.now() < this.retryValkeyAtMs) {
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
