export { JOB_PRESENCE } from './application/tokens';
export { CLEAN_JOB_QUEUE_INDEX_TASK_ID, KEEP_COMPLETED_JOBS, KEEP_FAILED_JOBS } from './domain/constants';
export { UnregisteredQueueError } from './domain/errors';
export { type JobPresence, type JobPresencePort, presenceOf } from './domain/job-presence.port';
export { parsePooledJobId, type PooledJobId, toPooledJobId } from './domain/pooled-job-id';
export { BullMqJobPresence } from './infrastructure/bullmq-job-presence';
export { cleanPoolIndexesTask } from './infrastructure/clean-pool-indexes.task';
export { bullMqJobOptions } from './infrastructure/job-options';
export {
  PooledJobQueueStrategy,
  type PooledJobQueueStrategyOptions,
  poolOptionsFor,
  poolPrefix,
} from './infrastructure/pooled-job-queue.strategy';
export { configurePlatformJobs, PlatformJobsPlugin, type PlatformJobsPluginOptions } from './platform-jobs.plugin';
