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

/** A semaphore lease lasts 10 min; a holder whose process died stops counting after it (D100). */
export const SEMAPHORE_LEASE_MS = 600_000;
/** The shortest wait before a job turned away by a busy semaphore runs again (D100). */
export const SEMAPHORE_RETRY_MIN_MS = 5_000;
/** The longest such wait; the spread keeps re-queued jobs of one business from returning together (D100). */
export const SEMAPHORE_RETRY_MAX_MS = 30_000;

/** Failures within {@link BREAKER_WINDOW_MS} that open a breaker (D100). */
export const BREAKER_FAILURE_THRESHOLD = 5;
/** The sliding window in which failures are counted (D100). */
export const BREAKER_WINDOW_MS = 120_000;
/** How long an open breaker turns calls away before it lets one probe through (D100). */
export const BREAKER_OPEN_MS = 60_000;
/** A probe that has not reported within this long is presumed lost, and the next caller probes instead. */
export const BREAKER_PROBE_LEASE_MS = 60_000;
/** An open breaker's record is dropped after a day without traffic, which closes it. */
export const BREAKER_RECORD_TTL_MS = 86_400_000;

/** How long a Valkey command of the semaphore or the breaker may take before it is given up (D31, D100). */
export const VALKEY_COMMAND_TIMEOUT_MS = 250;
/** After a Valkey failure it is not asked again for this long, so an outage does not add a timeout to every job. */
export const VALKEY_OUTAGE_RETRY_MS = 2_000;
/** The most often the same Valkey outage is logged. */
export const VALKEY_ERROR_LOG_INTERVAL_MS = 30_000;
/** Command timeouts in a row after which the Valkey socket is presumed hung and replaced. */
export const VALKEY_HUNG_SOCKET_TIMEOUTS = 5;
/** How long boot waits for the first Valkey connection before carrying on without one. */
export const VALKEY_STARTUP_WAIT_MS = 1_000;

/** A continuation job id ends in `-r{n}`: the n-th re-queue of a job a busy semaphore turned away (D100). */
export const CONTINUATION_SUFFIX = /^(?<base>.+)-r(?<count>\d+)$/;

/** The longest scheduled task id the heartbeat table stores. */
export const TASK_ID_MAX_LENGTH = 100;

/** How much a continuation's count grows over the job it continues. */
export const CONTINUATION_STEP = 1;
