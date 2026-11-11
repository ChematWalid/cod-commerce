import { type RuntimeVendureConfig, ScheduledTask } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { CLEAN_JOB_QUEUE_INDEX_TASK_ID } from '../../domain/constants';
import { cleanPoolIndexesTask } from '../../infrastructure/clean-pool-indexes.task';
import { jobReconcilerTask } from '../../infrastructure/job-reconciler.task';
import { PooledJobQueueStrategy } from '../../infrastructure/pooled-job-queue.strategy';
import { configurePlatformJobs } from '../../platform-jobs.plugin';

const stockStrategy = { add: () => Promise.reject(new Error('stock')) };

const stockIndexTask = new ScheduledTask({
  id: CLEAN_JOB_QUEUE_INDEX_TASK_ID,
  schedule: (cron) => cron.everyMinute(),
  execute: () => Promise.resolve(),
});
const otherTask = new ScheduledTask({
  id: 'clean-sessions',
  schedule: (cron) => cron.everyDay(),
  execute: () => Promise.resolve(),
});

const configWithStockQueue = (): RuntimeVendureConfig =>
  ({
    jobQueueOptions: { jobQueueStrategy: stockStrategy, activeQueues: [] },
    schedulerOptions: { tasks: [otherTask, stockIndexTask] },
  }) as unknown as RuntimeVendureConfig;

describe('configurePlatformJobs', () => {
  it('installs the pooled strategy, the index task of every pool and the job reconciler', () => {
    // Act
    const config = configurePlatformJobs(configWithStockQueue(), {
      redisUrl: 'redis://valkey:6379',
      appEnv: 'test',
      pooledQueues: { connection: { host: 'valkey' } },
    });

    // Assert
    expect(config.jobQueueOptions.jobQueueStrategy).toBeInstanceOf(PooledJobQueueStrategy);
    expect(config.schedulerOptions.tasks).toEqual([otherTask, cleanPoolIndexesTask, jobReconcilerTask]);
    expect(cleanPoolIndexesTask.id).toBe(CLEAN_JOB_QUEUE_INDEX_TASK_ID);
  });

  it('keeps the stock strategy and task without pooled queues', () => {
    // Act
    const config = configurePlatformJobs(configWithStockQueue(), { redisUrl: 'redis://valkey:6379', appEnv: 'test' });

    // Assert
    expect(config.jobQueueOptions.jobQueueStrategy).toBe(stockStrategy);
    expect(config.schedulerOptions.tasks).toEqual([otherTask, stockIndexTask]);
  });
});
