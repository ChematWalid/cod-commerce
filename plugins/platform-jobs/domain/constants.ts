/** Separates the pool from the BullMQ id in a job id that leaves the pooled strategy: `critical.ob-7301`. */
export const POOLED_JOB_ID_SEPARATOR = '.';

/** BullMQ's default key root; a pool's prefix is `bull:{APP_ENV}:{pool}` (D97). */
export const BULL_PREFIX_ROOT = 'bull';

/** Id of the stock task that cleans the job list index; the pooled task keeps it so it replaces the stock one. */
export const CLEAN_JOB_QUEUE_INDEX_TASK_ID = 'clean-job-queue-index';

const SECONDS_PER_HOUR = 3600;
const HOURS_PER_DAY = 24;
const FAILED_JOB_KEEP_DAYS = 14;

/** Completed jobs stay one hour, at most 1 000 of them (ADR 0013 (e), D98). */
export const KEEP_COMPLETED_JOBS = { age: SECONDS_PER_HOUR, count: 1000 } as const;

/** Failed jobs stay 14 days, for inspection and the reconciler (ADR 0013 (e), D98). */
export const KEEP_FAILED_JOBS = { age: FAILED_JOB_KEEP_DAYS * HOURS_PER_DAY * SECONDS_PER_HOUR } as const;
