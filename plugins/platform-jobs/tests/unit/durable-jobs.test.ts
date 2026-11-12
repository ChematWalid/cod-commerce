import { ConfigService } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { isLastAttempt } from '../../application/platform-queues';
import { continuationJobId } from '../../domain/continuation-job-id';
import { jobAttemptOf } from '../../infrastructure/job-attempt';
import { PooledJobQueueStrategy } from '../../infrastructure/pooled-job-queue.strategy';

describe('continuationJobId', () => {
  it.each([
    ['ob-1', 'ob-1-r1'],
    ['ob-1-r1', 'ob-1-r2'],
    ['ob-1-r2', 'ob-1-r3'],
    ['od-7-demo-log-r9', 'od-7-demo-log-r10'],
    ['od-7-retry', 'od-7-retry-r1'],
  ])('turns %s into %s', (jobId, expected) => {
    // Act
    const next = continuationJobId(jobId);

    // Assert
    expect(next).toBe(expected);
  });
});

describe('isLastAttempt', () => {
  it.each([
    [{ attempts: 1, retries: 2 }, false],
    [{ attempts: 2, retries: 2 }, false],
    [{ attempts: 3, retries: 2 }, true],
    [{ attempts: 1, retries: 0 }, true],
  ])('reads %j as %s', (job, expected) => {
    // Act
    const last = isLastAttempt(job);

    // Assert
    expect(last).toBe(expected);
  });
});

describe('jobAttemptOf', () => {
  const configWith = (strategy: unknown) => ({ jobQueueOptions: { jobQueueStrategy: strategy } }) as ConfigService;

  it('counts the running run for the BullMQ based strategy, whose job holds the runs already ended', () => {
    // Arrange
    const strategy = new PooledJobQueueStrategy({ appEnv: 'test', bullMq: {} });

    // Act
    const attempt = jobAttemptOf({ attempts: 0, retries: 7 }, configWith(strategy));

    // Assert
    expect(attempt).toEqual({ attempts: 1, retries: 7 });
  });

  it('keeps the count of a strategy that already counts the running run', () => {
    // Act
    const attempt = jobAttemptOf({ attempts: 1, retries: 7 }, configWith({}));

    // Assert
    expect(attempt).toEqual({ attempts: 1, retries: 7 });
  });
});
