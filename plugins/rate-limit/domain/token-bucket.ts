import { MS_PER_SECOND } from './constants';
import { ALLOWED, type RateLimitDecision } from './decision';
import type { RateLimitPolicy } from './policies';

/** What a bucket remembers between two requests. */
export interface BucketState {
  readonly tokens: number;
  readonly updatedAtMs: number;
}

/** The decision for one request and the bucket it leaves behind. */
export interface BucketStep {
  readonly decision: RateLimitDecision;
  readonly state: BucketState;
}

/** Absorbs floating-point drift, so 6 s of refill at 10 per minute reliably buys the token it should. */
const TOKEN_EPSILON = 1e-9;

/** Tokens added per millisecond. */
const refillRate = (policy: RateLimitPolicy): number => policy.capacity / (policy.windowSeconds * MS_PER_SECOND);

/** The bucket's tokens at `nowMs`, refilled up to capacity. A clock that went backwards refills nothing. */
function refilled(state: BucketState | undefined, policy: RateLimitPolicy, nowMs: number): number {
  if (state === undefined) {
    return policy.capacity;
  }
  const elapsedMs = Math.max(0, nowMs - state.updatedAtMs);
  return Math.min(policy.capacity, state.tokens + elapsedMs * refillRate(policy));
}

/**
 * Takes one token from `state` (a missing bucket is full). A refused request takes nothing, so hammering a
 * limited key does not push the retry time further out. The Lua script in the Valkey adapter must do the same.
 */
export function takeToken(state: BucketState | undefined, policy: RateLimitPolicy, nowMs: number): BucketStep {
  const tokens = refilled(state, policy, nowMs);
  // Never move the stamp back: instances with slightly different clocks would otherwise refill twice.
  const updatedAtMs = Math.max(nowMs, state?.updatedAtMs ?? nowMs);
  if (tokens + TOKEN_EPSILON >= 1) {
    return { decision: ALLOWED, state: { tokens: tokens - 1, updatedAtMs } };
  }
  const waitMs = (1 - tokens) / refillRate(policy);
  return {
    decision: { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(Math.round(waitMs) / MS_PER_SECOND)) },
    state: { tokens, updatedAtMs },
  };
}

/** Milliseconds after which an untouched bucket is full again and may be forgotten. */
export function idleExpiryMs(policy: RateLimitPolicy): number {
  return policy.windowSeconds * MS_PER_SECOND;
}
