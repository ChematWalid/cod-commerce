/** The OpenTelemetry meter the platform gauges belong to. */
export const METER_NAME = 'cod-platform';

/**
 * The gauge names of ADR 0015. Labels stay within its cardinality rule: `pool`, `queue` (a job name), `state` and
 * `task` are bounded sets, and no gauge carries a business, store or order id.
 */
export const METRIC_NAMES = {
  outboxPending: 'outbox_pending',
  outboxOldestAge: 'outbox_oldest_age_seconds',
  schedulerLastSuccessAge: 'scheduler_task_last_success_age_seconds',
  queuePoolJobs: 'queue_pool_jobs',
  queueJobs: 'queue_jobs',
  queueOldestWaitingAge: 'queue_oldest_waiting_age_seconds',
  intakeSpoolLength: 'intake_spool_length',
} as const;

/** One of the {@link METRIC_NAMES}. */
export type MetricName = (typeof METRIC_NAMES)[keyof typeof METRIC_NAMES];

/** The job states the queue gauges report (ADR 0015 "waiting/active/failed/delayed"). */
export const QUEUE_JOB_STATES = ['waiting', 'active', 'failed', 'delayed'] as const;

/** One of the {@link QUEUE_JOB_STATES}. */
export type QueueJobState = (typeof QUEUE_JOB_STATES)[number];

/**
 * Jobs read per state and pool on each collection, oldest first, to split the pool's counts by job name. The pool
 * totals stay exact; above this many jobs in one state the per-name split covers the oldest ones only, which is
 * where the oldest-waiting age comes from. Bounded so one collection costs at most a few hundred Valkey reads.
 */
export const QUEUE_SAMPLE_LIMIT = 200;

/** The intake spool does not exist before P3.S4: its length is reported as 0 so dashboards and alerts can be built. */
export const INTAKE_SPOOL_LENGTH_UNTIL_P3S4 = 0;

export const MS_PER_SECOND = 1000;

/** The log context of the plugin. */
export const METRICS_LOG_CONTEXT = 'PlatformMetrics';
