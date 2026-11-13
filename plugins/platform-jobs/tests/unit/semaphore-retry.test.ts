import { describe, expect, it } from 'vitest';
import { SEMAPHORE_RETRY_MAX_MS, SEMAPHORE_RETRY_MIN_MS } from '../../domain/constants';
import { semaphoreRetryDelayMs } from '../../domain/semaphore';

describe('semaphoreRetryDelayMs', () => {
  it('spreads the delay uniformly from 5 s to 30 s', () => {
    // Act
    const lowest = semaphoreRetryDelayMs(() => 0);
    const middle = semaphoreRetryDelayMs(() => 0.5);
    const highest = semaphoreRetryDelayMs(() => 0.999_999_999);

    // Assert
    expect(lowest).toBe(SEMAPHORE_RETRY_MIN_MS);
    expect(middle).toBe(17_500);
    expect(highest).toBe(SEMAPHORE_RETRY_MAX_MS);
  });
});
