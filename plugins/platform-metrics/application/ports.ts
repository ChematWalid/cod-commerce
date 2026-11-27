import type { QueuePool } from '@cod/shared';
import type { QueueSnapshot } from '../domain/queue-gauges';

/** Reads one pool's BullMQ queue. */
export interface QueueSnapshotPort {
  snapshotOf(pool: QueuePool): Promise<QueueSnapshot>;
}

/** The outbox's pending events across businesses: the count and the creation time of the oldest (D120). */
export interface OutboxBacklogPort {
  pendingSummary(): Promise<{ readonly pending: number; readonly oldest: Date | null }>;
}

/** The scheduled tasks: when each last finished a run without error, by task id (D120), and every configured id. */
export interface TaskSuccessPort {
  lastSuccess(): Promise<ReadonlyMap<string, Date>>;
  /** Every configured task, so one that never succeeded is still known. */
  scheduledTaskIds(): readonly string[];
}

/** Where a failed read is reported; the other gauges are still collected. */
export interface MetricsLogger {
  error(message: string): void;
}

/** Everything {@link PlatformGaugesService} reads. */
export interface PlatformGaugeSources {
  readonly queues: QueueSnapshotPort;
  readonly pools: readonly QueuePool[];
  readonly outbox: OutboxBacklogPort;
  readonly tasks: TaskSuccessPort;
  readonly now: () => number;
  readonly logger: MetricsLogger;
}
