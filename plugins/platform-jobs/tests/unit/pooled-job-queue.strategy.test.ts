import { QUEUES } from '@cod/shared';
import { Job } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { UnregisteredQueueError } from '../../domain/errors';
import { PooledJobQueueStrategy, poolOptionsFor } from '../../infrastructure/pooled-job-queue.strategy';

const bullMq = { connection: { host: 'valkey', port: 6379 }, workerOptions: { prefix: 'ignored' } };

describe('PooledJobQueueStrategy', () => {
  it('refuses to add a job to a queue outside the registry', async () => {
    // Arrange
    const strategy = new PooledJobQueueStrategy({ appEnv: 'test', bullMq });

    // Act
    const add = strategy.add(new Job({ queueName: 'probe-bulk', data: {} }));

    // Assert
    await expect(add).rejects.toThrow(UnregisteredQueueError);
    await expect(add).rejects.toMatchObject({ code: 'platform-jobs.unregistered-queue' });
  });

  it('refuses to start a queue outside the registry', async () => {
    // Arrange
    const strategy = new PooledJobQueueStrategy({ appEnv: 'test', bullMq });

    // Act
    const start = strategy.start('probe-critical', () => Promise.resolve());

    // Assert
    await expect(start).rejects.toThrow(UnregisteredQueueError);
  });

  it('answers undefined for an id that names no pool', async () => {
    // Arrange
    const strategy = new PooledJobQueueStrategy({ appEnv: 'test', bullMq });

    // Act and assert
    await expect(strategy.findOne('42')).resolves.toBeUndefined();
    await expect(strategy.cancelJob('llm.42')).resolves.toBeUndefined();
  });

  it('passes job ids through the Admin API unchanged', () => {
    expect(new PooledJobQueueStrategy({ appEnv: 'test', bullMq }).useEntityIdStrategyForJobIds).toBe(false);
  });
});

describe('poolOptionsFor', () => {
  it('gives each pool its own prefix on the queue and the worker', () => {
    // Act
    const critical = poolOptionsFor(bullMq, 'staging', 'critical');
    const bulk = poolOptionsFor(bullMq, 'staging', 'bulk');

    // Assert
    expect(critical.queueOptions?.prefix).toBe('bull:staging:critical');
    expect(critical.workerOptions?.prefix).toBe('bull:staging:critical');
    expect(bulk.queueOptions?.prefix).toBe('bull:staging:bulk');
    expect(bulk.workerOptions?.prefix).toBe('bull:staging:bulk');
    expect(critical.connection).toBe(bullMq.connection);
  });

  it('reads concurrency from the registry and keeps settled jobs per ADR 0013 (e)', () => {
    // Act
    const options = poolOptionsFor(bullMq, 'test', 'bulk');

    // Assert
    const concurrency = options.concurrency as (queueName: string) => number;
    expect(concurrency('analytics')).toBe(QUEUES.analytics.concurrency);
    expect(options.workerOptions).toMatchObject({
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 14 * 24 * 3600 },
    });
  });

  it('maps job options from the registry unless the caller sets its own', () => {
    // Arrange
    const own = (): Record<string, never> => ({});

    // Act
    const registry = poolOptionsFor(bullMq, 'test', 'critical');
    const custom = poolOptionsFor({ ...bullMq, setJobOptions: own }, 'test', 'critical');

    // Assert
    expect(registry.setJobOptions?.('dispatch', new Job({ queueName: 'dispatch', data: {} }))).toMatchObject({
      attempts: QUEUES.dispatch.attempts,
    });
    expect(custom.setJobOptions).toBe(own);
  });
});
