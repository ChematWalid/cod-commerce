/** The scheduled task's id; its heartbeat row carries the same (D120). */
export const PARTITION_MAINTENANCE_TASK_ID = 'partition-maintenance';

/** Daily at 02:00 UTC (D106). */
export const PARTITION_MAINTENANCE_SCHEDULE = '0 2 * * *';

/** The task's timeout: five minutes. */
export const PARTITION_MAINTENANCE_TIMEOUT_MS = 5 * 60 * 1000;

/** `SET LOCAL lock_timeout` of each table's transaction: a stuck lock fails the table instead of queueing behind it. */
export const PARTITION_LOCK_TIMEOUT = '5s';

/** Prefix of the advisory lock key text, `partition:{table}`, so one table is maintained by one transaction (D106). */
export const PARTITION_LOCK_KEY_PREFIX = 'partition:';

/** Separator between a table name and the date part of its partitions' names. */
export const PARTITION_NAME_SEPARATOR = '_p';

/** A table or column name the maintenance may put in DDL: letters, digits and underscores only (always quoted too). */
export const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** PostgreSQL truncates identifiers longer than this, which would make two partitions share a name. */
export const MAX_IDENTIFIER_LENGTH = 63;

/** The longest date part of a partition name (`yyyymmdd`) plus its separator. */
export const PARTITION_SUFFIX_LENGTH = 10;

/** The `LOG_CONTEXT` of everything this plugin logs. */
export const PARTITIONS_LOG_CONTEXT = 'PlatformPartitions';
