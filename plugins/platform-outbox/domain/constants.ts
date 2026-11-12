/** The Vendure log context of the outbox. */
export const OUTBOX_LOG_CONTEXT = 'PlatformOutbox';

/** The tables of the outbox (D106). */
export const OUTBOX_EVENT_TABLE = 'outbox_event';
export const OUTBOX_DELIVERY_TABLE = 'outbox_delivery';

/** Days an event or delivery partition is kept behind the current day (D107). */
export const OUTBOX_RETAIN_DAYS = 7;

/** Days of partitions made ahead of the current one (D106). */
export const OUTBOX_PREMAKE_DAYS = 7;

/** The most characters of an error a delivery keeps in `lastError`. */
export const OUTBOX_LAST_ERROR_MAX_LENGTH = 500;

/** The longest consumer name; it becomes part of a job id and a column of 40 characters (D102). */
export const OUTBOX_CONSUMER_NAME_MAX_LENGTH = 40;

/** A consumer name is kebab-case: lower-case words joined by single dashes. */
export const OUTBOX_CONSUMER_NAME_FORMAT = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** The longest `dedupeKey` the column holds. */
export const OUTBOX_DEDUPE_KEY_MAX_LENGTH = 200;

/** An id of an outbox event or aggregate: a snowflake in decimal form. */
export const OUTBOX_ID_FORMAT = /^[1-9][0-9]{0,18}$/;

/** The largest value of the `bigint` columns an id lands in. */
export const OUTBOX_ID_MAX = 9223372036854775807n;

/** The queue of relay jobs (D101). */
export const OUTBOX_RELAY_QUEUE = 'outbox-relay' as const;

/** A pending event or an open delivery is left to the relay and the wrappers for this long before it is swept (D104). */
export const OUTBOX_SWEEP_AFTER_MS = 60_000;

const DAY_MS = 86_400_000;
const RETENTION_DAYS = 7;

/** The sweeper and the reconciler look no further back than the retention window (D107). */
export const OUTBOX_SWEEP_WINDOW_MS = RETENTION_DAYS * DAY_MS;

/** Rows the sweeper takes per transaction. */
export const OUTBOX_SWEEP_BATCH_SIZE = 500;

/** How long one sweeper run keeps taking batches. */
export const OUTBOX_SWEEP_BUDGET_MS = 40_000;

/** The sweeper's scheduled task. */
export const OUTBOX_SWEEPER_TASK_ID = 'outbox-sweeper';

/** The name of the outbox's rows in the reconciler. */
export const OUTBOX_RECONCILE_SOURCE = 'outbox-delivery';

/** What the reconciler writes to `lastError` of a delivery that used every attempt (D105). */
export const OUTBOX_EXHAUSTED_ERROR = 'reconciler: attempts exhausted';
