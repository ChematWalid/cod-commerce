import {
  type LockoutStatus,
  RATE_LIMIT_POLICIES,
  type RateLimitDecision,
  RateLimitedError,
  RateLimiter,
  type RateLimitPolicyName,
} from '@cod/plugin-rate-limit';
import { describe, expect, it } from 'vitest';
import { actorKeyOf, TeamThrottle } from '../../api/team-throttle';
import { ownerOfA } from '../fakes/invitation-world';

const NOT_LOCKED: LockoutStatus = { locked: false, retryAfterSeconds: 0 };

/** A limiter with no refill: each bucket allows its policy's capacity, then refuses. */
class CountingLimiter extends RateLimiter {
  private readonly spent = new Map<string, number>();

  consume(policy: RateLimitPolicyName, key: string): Promise<RateLimitDecision> {
    const bucket = `${policy}|${key}`;
    const used = this.spent.get(bucket) ?? 0;
    const capacity = RATE_LIMIT_POLICIES[policy].capacity;
    if (used >= capacity) return Promise.resolve({ allowed: false, retryAfterSeconds: 60, exhausted: true });
    this.spent.set(bucket, used + 1);
    return Promise.resolve({ allowed: true, retryAfterSeconds: 0, exhausted: used + 1 >= capacity });
  }

  /** Tokens taken from the bucket of `key` under `policy`. */
  tokensTaken(policy: RateLimitPolicyName, key: string): number {
    return this.spent.get(`${policy}|${key}`) ?? 0;
  }

  lockout(): Promise<LockoutStatus> {
    return Promise.resolve(NOT_LOCKED);
  }

  isLocked(): Promise<LockoutStatus> {
    return Promise.resolve(NOT_LOCKED);
  }

  clearLockout(): Promise<void> {
    return Promise.resolve();
  }
}

describe('TeamThrottle.spendInvite', () => {
  it('refuses an administrator past its own budget without spending the business budget', async () => {
    // Arrange
    const limiter = new CountingLimiter();
    const throttle = new TeamThrottle(limiter);
    const actorCapacity = RATE_LIMIT_POLICIES['team-invite-actor'].capacity;
    for (let i = 0; i < actorCapacity; i += 1) await throttle.spendInvite(ownerOfA);
    const businessKey = ownerOfA.scope.businessId;
    const businessSpentBefore = limiter.tokensTaken('team-invite-business', businessKey);

    // Act
    const refused = throttle.spendInvite(ownerOfA);

    // Assert
    await expect(refused).rejects.toBeInstanceOf(RateLimitedError);
    expect(limiter.tokensTaken('team-invite-actor', actorKeyOf(ownerOfA))).toBe(actorCapacity);
    expect(limiter.tokensTaken('team-invite-business', businessKey)).toBe(businessSpentBefore);
  });
});
