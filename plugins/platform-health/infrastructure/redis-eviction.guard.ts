import { DomainError } from '@cod/shared';
import { REQUIRED_REDIS_EVICTION_POLICY } from '../domain/constants';

/** Valkey may evict keys, which silently drops BullMQ jobs and locks. */
export class RedisEvictionPolicyError extends DomainError {
  readonly code = 'platform-health.redis-eviction-policy';

  constructor(readonly policy: string) {
    super(
      `Valkey maxmemory-policy is "${policy}"; it must be "${REQUIRED_REDIS_EVICTION_POLICY}" so that queued jobs are never evicted`,
    );
  }
}

/** What the guard needs from a connected Valkey client: `CONFIG GET`. */
export interface RedisConfigReader {
  config(subcommand: 'GET', parameter: string): Promise<unknown>;
}

const POLICY_PARAMETER = 'maxmemory-policy';
const UNKNOWN_POLICY = 'unknown';

/** `CONFIG GET` answers a flat `[name, value]` list. */
const policyOf = (reply: unknown): string => {
  if (!Array.isArray(reply)) {
    return UNKNOWN_POLICY;
  }
  const value: unknown = reply[1];
  return typeof value === 'string' ? value : UNKNOWN_POLICY;
};

/**
 * Fails boot unless Valkey's `maxmemory-policy` is `noeviction`.
 *
 * @throws {RedisEvictionPolicyError} for any other policy, or when the policy cannot be read.
 */
export async function assertNoEviction(redis: RedisConfigReader): Promise<void> {
  const policy = policyOf(await redis.config('GET', POLICY_PARAMETER));
  if (policy !== REQUIRED_REDIS_EVICTION_POLICY) {
    throw new RedisEvictionPolicyError(policy);
  }
}
