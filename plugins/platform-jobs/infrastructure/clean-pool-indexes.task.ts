import { ConfigService, Logger, ScheduledTask } from '@vendure/core';
import { CLEAN_JOB_QUEUE_INDEX_TASK_ID } from '../domain/constants';
import { PooledJobQueueStrategy } from './pooled-job-queue.strategy';

const LOG_CONTEXT = 'PlatformJobsPlugin';

/**
 * Replaces the stock `clean-job-queue-index` task (same id), which cleans only the plugin's singleton index:
 * this one cleans the job list index of every pool (D97).
 */
export const cleanPoolIndexesTask = new ScheduledTask({
  id: CLEAN_JOB_QUEUE_INDEX_TASK_ID,
  description: 'Cleans up the job list index of every queue pool',
  schedule: (cron) => cron.everyMinute(),
  async execute({ injector }) {
    const strategy = injector.get(ConfigService).jobQueueOptions.jobQueueStrategy;
    if (!(strategy instanceof PooledJobQueueStrategy)) {
      Logger.error('clean-job-queue-index runs without the pooled job queue strategy; nothing cleaned', LOG_CONTEXT);
      return [];
    }
    return strategy.cleanIndexes();
  },
});
