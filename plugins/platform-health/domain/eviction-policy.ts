import { DomainError } from '@cod/shared';
import { REQUIRED_REDIS_EVICTION_POLICY } from './constants';

/** Valkey may evict keys, which silently drops BullMQ jobs and locks. */
export class RedisEvictionPolicyError extends DomainError {
  readonly code = 'platform-health.redis-eviction-policy';

  constructor(readonly policy: string) {
    super(
      `Valkey maxmemory-policy is "${policy}"; it must be "${REQUIRED_REDIS_EVICTION_POLICY}" so that queued jobs are never evicted`,
    );
  }
}

/** Valkey refuses `CONFIG GET` (a managed service may disable it), so the eviction policy cannot be verified. */
export class RedisConfigUnavailableError extends DomainError {
  readonly code = 'platform-health.redis-config-unavailable';

  constructor() {
    super(
      `Valkey refuses CONFIG GET, so its maxmemory-policy cannot be verified; allow CONFIG GET for this client and set the policy to "${REQUIRED_REDIS_EVICTION_POLICY}"`,
    );
  }
}

/** @throws {RedisEvictionPolicyError} unless `policy` is `noeviction`. */
export function assertNoEvictionPolicy(policy: string): void {
  if (policy !== REQUIRED_REDIS_EVICTION_POLICY) {
    throw new RedisEvictionPolicyError(policy);
  }
}

/**
 * True when `error` is a verdict on the policy (wrong, or not verifiable) rather than Valkey being out of
 * reach. A verdict fails boot; an unreachable Valkey does not.
 */
export const isEvictionPolicyVerdict = (error: unknown): boolean =>
  error instanceof RedisEvictionPolicyError || error instanceof RedisConfigUnavailableError;
