import {
  type LockoutStatus,
  RATE_LIMIT_POLICIES,
  type RateLimitDecision,
  RateLimiter,
  type RateLimitPolicyName,
} from '@cod/plugin-rate-limit';

const LOCKOUT_SECONDS = 60;
const RETRY_AFTER_SECONDS = 6;
const NOT_LOCKED: LockoutStatus = { locked: false, retryAfterSeconds: 0 };

/**
 * A limiter with a frozen clock: buckets never refill and lockouts never end. Each call takes or gives a token
 * atomically, as the Valkey script does, and records the lockouts it starts.
 */
export class InMemoryRateLimiter extends RateLimiter {
  /** Every key `lockout` was called for, in order. */
  readonly lockouts: string[] = [];
  private readonly tokens = new Map<string, number>();
  private readonly locked = new Set<string>();

  consume(policy: RateLimitPolicyName, key: string): Promise<RateLimitDecision> {
    const id = `${policy}:${key}`;
    const left = this.tokensOf(policy, id);
    if (left < 1) {
      return Promise.resolve({ allowed: false, retryAfterSeconds: RETRY_AFTER_SECONDS, exhausted: true });
    }
    this.tokens.set(id, left - 1);
    return Promise.resolve({ allowed: true, retryAfterSeconds: 0, exhausted: left - 1 < 1 });
  }

  refund(policy: RateLimitPolicyName, key: string): Promise<void> {
    const id = `${policy}:${key}`;
    this.tokens.set(id, Math.min(RATE_LIMIT_POLICIES[policy].capacity, this.tokensOf(policy, id) + 1));
    return Promise.resolve();
  }

  lockout(key: string): Promise<LockoutStatus> {
    this.lockouts.push(key);
    this.locked.add(key);
    return Promise.resolve({ locked: true, retryAfterSeconds: LOCKOUT_SECONDS });
  }

  isLocked(key: string): Promise<LockoutStatus> {
    return Promise.resolve(this.locked.has(key) ? { locked: true, retryAfterSeconds: LOCKOUT_SECONDS } : NOT_LOCKED);
  }

  clearLockout(key: string): Promise<void> {
    this.locked.delete(key);
    return Promise.resolve();
  }

  /** Tokens left in the bucket of `key` under `policy`; an untouched bucket is full. */
  remaining(policy: RateLimitPolicyName, key: string): number {
    return this.tokensOf(policy, `${policy}:${key}`);
  }

  private tokensOf(policy: RateLimitPolicyName, id: string): number {
    return this.tokens.get(id) ?? RATE_LIMIT_POLICIES[policy].capacity;
  }
}
