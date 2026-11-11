import type { DurableJobData, QueueName } from '@cod/shared';

/** One durable row whose BullMQ job the reconciler checks (D105). */
export interface DueJob {
  readonly queue: QueueName;
  /** The job's data; `data.jobId` is its BullMQ id. */
  readonly data: DurableJobData & Record<string, string | number>;
  /** How many runs the row has started. */
  readonly attempts: number;
  /** When the row was last handed to the queue (or last moved): the SLA counts from here. */
  readonly stuckSince: Date;
  /** When the row says its next run is due; a live job is left alone until then. */
  readonly nextAttemptAt?: Date | null;
}

/**
 * A table of durable rows a plugin hands to the reconciler (D105). The reconciler decides per row from what BullMQ
 * holds; the source only finds rows and records the outcome.
 */
export interface ReconcileSource {
  readonly name: string;
  /** Non-terminal rows, oldest first, at most `limit`; rows touched in the last minute are left out. */
  findDue(now: Date, limit: number): Promise<readonly DueJob[]>;
  /** The jobs were added again at `now`. */
  markEnqueued(jobs: readonly DueJob[], now: Date): Promise<void>;
  /** The rows used every attempt and are past due: end them as failed, with the reconciler's `lastError`. */
  markExhausted(jobs: readonly DueJob[], now: Date): Promise<void>;
}

/** What {@link JobReconciler} reports of its logging. */
export interface ReconcileLogger {
  error(message: string): void;
  warn(message: string): void;
}
