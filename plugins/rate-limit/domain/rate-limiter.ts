import type { LockoutStatus, RateLimitDecision } from './decision';
import type { RateLimitPolicyName } from './policies';

/**
 * The limiter other plugins use. An abstract class so it is also its own injection token.
 *
 * `consume` takes one token from the bucket of `key` under `policy`; `refund` puts one back, never above the
 * policy's capacity, for a caller that takes the token before the work it guards and then finds the work
 * should not count (a correct password, RL-1). A lockout is a separate, doubling
 * penalty on a key (D29): `lockout` starts the next one, `isLocked` reads it, `clearLockout` forgets the
 * key's history (a correct login).
 */
export abstract class RateLimiter {
  abstract consume(policy: RateLimitPolicyName, key: string): Promise<RateLimitDecision>;
  abstract refund(policy: RateLimitPolicyName, key: string): Promise<void>;
  abstract lockout(key: string): Promise<LockoutStatus>;
  abstract isLocked(key: string): Promise<LockoutStatus>;
  abstract clearLockout(key: string): Promise<void>;
}
