import type { PartitionPolicy } from '@cod/plugin-platform-partitions';
import { ACTIVITY_LOG_TABLE } from './activity-log-schema';

/** Months kept behind the current one (ADR 0016 section 3). */
export const ACTIVITY_LOG_RETAIN_MONTHS = 24;

/** Months created ahead of the current one. */
export const ACTIVITY_LOG_PREMAKE_MONTHS = 3;

/** Why an expired partition is not dropped: the archive that must receive it is built in P10.S2 (D123). */
export const ACTIVITY_LOG_ARCHIVE_PENDING_REASON = 'archive target not built (ADR 0016: archive (security))';

/**
 * The monthly policy of `activity_log`. An expired partition is kept, and reported, until an archive target exists:
 * the log is the audit trail, so retention must never destroy it unarchived.
 */
export const ACTIVITY_LOG_PARTITION_POLICY: PartitionPolicy = {
  table: ACTIVITY_LOG_TABLE,
  column: 'createdAt',
  interval: 'month',
  premake: ACTIVITY_LOG_PREMAKE_MONTHS,
  retain: ACTIVITY_LOG_RETAIN_MONTHS,
  keepIf: () => Promise.resolve(ACTIVITY_LOG_ARCHIVE_PENDING_REASON),
};
