import { QUEUES } from '@cod/shared';
import { Job } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { bullMqJobOptions } from '../../infrastructure/job-options';

type ProbeData = { jobId?: string | number; delayMs?: number };
const jobOf = (queueName: string, data: ProbeData): Job => new Job({ queueName, data });

describe('bullMqJobOptions', () => {
  it('takes attempts and backoff from the queue registry', () => {
    // Arrange
    const setJobOptions = bullMqJobOptions();

    // Act
    const options = setJobOptions('auth-email', jobOf('auth-email', {}));

    // Assert
    expect(options).toEqual({
      attempts: QUEUES['auth-email'].attempts,
      backoff: { type: 'exponential', delay: QUEUES['auth-email'].backoff.delayMs },
    });
  });

  it('maps a string jobId and a non-negative integer delayMs from the job data', () => {
    // Arrange
    const setJobOptions = bullMqJobOptions();

    // Act
    const options = setJobOptions('outbox-relay', jobOf('outbox-relay', { jobId: 'ob-7301', delayMs: 5000 }));

    // Assert
    expect(options).toEqual({
      attempts: QUEUES['outbox-relay'].attempts,
      backoff: { type: 'exponential', delay: QUEUES['outbox-relay'].backoff.delayMs },
      jobId: 'ob-7301',
      delay: 5000,
    });
  });

  it('ignores a numeric jobId, a negative or fractional delayMs', () => {
    // Arrange
    const setJobOptions = bullMqJobOptions();

    // Act
    const numeric = setJobOptions('order-effects', jobOf('order-effects', { jobId: 7301, delayMs: -1 }));
    const fractional = setJobOptions('order-effects', jobOf('order-effects', { delayMs: 1.5 }));

    // Assert
    expect(numeric).not.toHaveProperty('jobId');
    expect(numeric).not.toHaveProperty('delay');
    expect(fractional).not.toHaveProperty('delay');
  });

  it('runs a stock queue once', () => {
    // Act
    const options = bullMqJobOptions()('clean-sessions', jobOf('clean-sessions', {}));

    // Assert
    expect(options).toMatchObject({ attempts: 1 });
  });

  it('leaves a queue outside the registry to the stock options', () => {
    // Act
    const options = bullMqJobOptions()('probe-bulk', jobOf('probe-bulk', { jobId: 'x-1' }));

    // Assert
    expect(options).toEqual({});
  });
});
