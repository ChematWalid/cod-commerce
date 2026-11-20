import type { JobRowRef } from '../../domain/job-kinds';

/** Hands a committed export row to the `imports-exports` queue (D2211, D2212). */
export interface ExportQueuePort {
  enqueue(row: JobRowRef): Promise<void>;
}

/** Hands out the snowflake id of a new job row (ADR 0003). */
export interface JobIdGenerator {
  next(): string;
}
