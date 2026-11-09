import { describe, expect, it } from 'vitest';
import { InProcessBucket } from '../../infrastructure/in-process-bucket';
import { describeLimiterContract } from '../fakes/limiter-contract';
import { ManualClock } from '../fakes/manual-clock';

let counter = 0;

describeLimiterContract('InProcessBucket', () => {
  const clock = new ManualClock();
  const bucket = new InProcessBucket(clock.now);
  return {
    clock,
    uniqueKey: () => `key-${String(counter++)}`,
    limiter: {
      consume: (policy, key) => Promise.resolve(bucket.consume(policy, key)),
      lockout: (key) => Promise.resolve(bucket.lockout(key)),
      isLocked: (key) => Promise.resolve(bucket.isLocked(key)),
      clearLockout: (key) => {
        bucket.clearLockout(key);
        return Promise.resolve();
      },
    },
  };
});

describe('InProcessBucket', () => {
  it('lets a lockout end and starts the next one at twice the length while it is remembered', () => {
    // Arrange
    const clock = new ManualClock();
    const bucket = new InProcessBucket(clock.now);
    bucket.lockout('pair');

    // Act
    clock.advanceSeconds(61);
    const afterExpiry = bucket.isLocked('pair');
    const next = bucket.lockout('pair');

    // Assert
    expect(afterExpiry.locked).toBe(false);
    expect(next.retryAfterSeconds).toBe(120);
  });

  it('forgets a lockout history an hour after the lockout ended', () => {
    // Arrange
    const clock = new ManualClock();
    const bucket = new InProcessBucket(clock.now);
    bucket.lockout('pair');

    // Act
    clock.advanceSeconds(60 + 3600 + 1);

    // Assert
    expect(bucket.lockout('pair').retryAfterSeconds).toBe(60);
  });

  it('stays bounded when many distinct keys arrive', () => {
    // Arrange
    const clock = new ManualClock();
    const bucket = new InProcessBucket(clock.now, 100);

    // Act
    for (let i = 0; i < 1000; i += 1) {
      bucket.consume('login-ip', `ip-${String(i)}`);
    }

    // Assert
    expect(bucket.size).toBeLessThanOrEqual(100);
  });
});
