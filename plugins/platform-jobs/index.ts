export { isLastAttempt, type JobAttempt, PlatformQueues, type QueueProcessor } from './application/platform-queues';
export { JOB_PRESENCE, TASK_HEARTBEAT_WRITER } from './application/tokens';
export { type BreakerKey, type BreakerState, breakerStateAt, CircuitBreaker } from './domain/breaker';
export { PLATFORM_CLOCK, type PlatformClock, SYSTEM_CLOCK } from './domain/clock.port';
export {
  BREAKER_FAILURE_THRESHOLD,
  BREAKER_OPEN_MS,
  BREAKER_WINDOW_MS,
  CLEAN_JOB_QUEUE_INDEX_TASK_ID,
  KEEP_COMPLETED_JOBS,
  KEEP_FAILED_JOBS,
  SEMAPHORE_LEASE_MS,
  SEMAPHORE_RETRY_MAX_MS,
  SEMAPHORE_RETRY_MIN_MS,
  VALKEY_COMMAND_TIMEOUT_MS,
} from './domain/constants';
export { continuationJobId } from './domain/continuation-job-id';
export {
  CircuitOpenError,
  InvalidTaskIdError,
  QueueAlreadyDefinedError,
  QueueNotDefinedError,
  QueueRegistryClosedError,
  SemaphoreBusyError,
  UnregisteredQueueError,
} from './domain/errors';
export { type JobPresence, type JobPresencePort, presenceOf } from './domain/job-presence.port';
export { parsePooledJobId, type PooledJobId, toPooledJobId } from './domain/pooled-job-id';
export { BusinessSemaphore, type SemaphoreKey, semaphoreRetryDelayMs } from './domain/semaphore';
export { TaskHeartbeatReader, type TaskHeartbeatWriter } from './domain/task-heartbeat.port';
export { BullMqJobPresence } from './infrastructure/bullmq-job-presence';
export { catchUpTask, type CatchUpTaskConfig } from './infrastructure/catch-up-task';
export { cleanPoolIndexesTask } from './infrastructure/clean-pool-indexes.task';
export { bullMqJobOptions } from './infrastructure/job-options';
export {
  PooledJobQueueStrategy,
  type PooledJobQueueStrategyOptions,
  poolOptionsFor,
  poolPrefix,
} from './infrastructure/pooled-job-queue.strategy';
export { TaskHeartbeatEntity } from './infrastructure/task-heartbeat.entity';
export { TaskHeartbeatRepository } from './infrastructure/task-heartbeat.repository';
export { createPlatformRedis, PlatformValkey } from './infrastructure/valkey-client';
export { ValkeyBusinessSemaphore } from './infrastructure/valkey-business-semaphore';
export { ValkeyCircuitBreaker } from './infrastructure/valkey-circuit-breaker';
export { configurePlatformJobs, PlatformJobsPlugin, type PlatformJobsPluginOptions } from './platform-jobs.plugin';
