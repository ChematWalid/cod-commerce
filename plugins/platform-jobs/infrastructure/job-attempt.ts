import { ConfigService, type Job } from '@vendure/core';
import { BullMQJobQueueStrategy } from '@vendure/job-queue-plugin/package/bullmq/bullmq-job-queue-strategy';
import type { JobAttempt } from '../application/platform-queues';
import { PooledJobQueueStrategy } from './pooled-job-queue.strategy';

/**
 * Vendure's own strategies count the running attempt in `job.attempts` (the in-memory one calls `job.start()`),
 * while the BullMQ strategy copies `attemptsMade`, the runs that already ended. The processor wants one meaning:
 * the number of this run, counting from 1.
 */
export function jobAttemptOf(job: Pick<Job, 'attempts' | 'retries'>, config: ConfigService): JobAttempt {
  const { jobQueueStrategy } = config.jobQueueOptions;
  const countsFinishedRuns =
    jobQueueStrategy instanceof PooledJobQueueStrategy || jobQueueStrategy instanceof BullMQJobQueueStrategy;
  return { attempts: countsFinishedRuns ? job.attempts + 1 : job.attempts, retries: job.retries };
}
