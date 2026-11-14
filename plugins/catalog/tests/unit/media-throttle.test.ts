import { RateLimitedError, type RateLimiter, type RateLimitPolicyName } from '@cod/plugin-rate-limit';
import { toBusinessId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { MediaThrottle } from '../../api/media-throttle';

/** A limiter that records each spend and refuses the policies in `refused`. */
function limiterRefusing(refused: readonly RateLimitPolicyName[] = []) {
  const spent: string[] = [];
  const limiter = {
    consume: (policy: RateLimitPolicyName, key: string) => {
      spent.push(`${policy} ${key}`);
      const allowed = !refused.includes(policy);
      return Promise.resolve({ allowed, retryAfterSeconds: allowed ? 0 : 30 });
    },
  } as unknown as RateLimiter;
  return { limiter, spent };
}

const business = toBusinessId('101');

describe('MediaThrottle (D2138)', () => {
  it("spends the actor's budget, then the business's", async () => {
    // Arrange
    const { limiter, spent } = limiterRefusing();

    // Act
    await new MediaThrottle(limiter).spendUpload(business, '7');

    // Assert
    expect(spent).toEqual(['catalog-media-actor 101:7', 'catalog-media-business 101']);
  });

  it("refuses past the actor's budget without spending the business's", async () => {
    // Arrange
    const { limiter, spent } = limiterRefusing(['catalog-media-actor']);

    // Act
    const spending = new MediaThrottle(limiter).spendUpload(business, '7');

    // Assert
    await expect(spending).rejects.toBeInstanceOf(RateLimitedError);
    expect(spent).toEqual(['catalog-media-actor 101:7']);
  });

  it("refuses past the business's budget", async () => {
    // Arrange
    const { limiter } = limiterRefusing(['catalog-media-business']);

    // Act
    const spending = new MediaThrottle(limiter).spendUpload(business, '8');

    // Assert
    await expect(spending).rejects.toMatchObject({ retryAfterSeconds: 30 });
  });
});
