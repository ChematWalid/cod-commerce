import type { DurableJobData, QueueName } from '@cod/shared';
import { continuationJobId } from '../domain/continuation-job-id';

/** Where a job is in its retries, as a processor sees it. */
export interface JobAttempt {
  /** The number of this run, counting from 1. */
  readonly attempts: number;
  /** The most re-runs after the first one (`attempts` in the queue registry minus one). */
  readonly retries: number;
}

/** True when this run is the job's last: a failure now is final, so the processor should park or fail the work. */
export function isLastAttempt(job: JobAttempt): boolean {
  return job.attempts > job.retries;
}

/** The processor of one queue. It sees the job's data and its place in the retries, never a Vendure `Job`. */
export type QueueProcessor<Data extends DurableJobData> = (data: Data, job: JobAttempt) => Promise<void>;

/**
 * The one way plugins create and feed the platform's queues (D99, D102). A queue is a name of the queue registry in
 * `@cod/shared`, so its pool, attempts and backoff come from there; a durable job carries its id in `data.jobId`.
 * Processors see the raw BullMQ id; only jobs listed through the strategy carry `{pool}.{id}`.
 */
export abstract class PlatformQueues {
  /**
   * Creates the queue `name` with one processor. Call it from `onModuleInit` only: every process then creates the
   * queue and a worker of the queue's pool consumes it.
   * @throws QueueRegistryClosedError after bootstrap, QueueAlreadyDefinedError for a second definition and
   * UnregisteredQueueError for a name outside the registry.
   */
  abstract define<Data extends DurableJobData>(name: QueueName, process: QueueProcessor<Data>): void;

  /**
   * Adds a job with `retries` set to the registry's attempts minus one, so the in-memory strategy of the plugin
   * tests retries as BullMQ does.
   * @throws QueueNotDefinedError when no plugin defined `name` in this process.
   */
  // `Data` lets a caller pass an object literal with the job's own fields, which a plain `DurableJobData` rejects.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  abstract add<Data extends DurableJobData>(name: QueueName, data: Data): Promise<void>;

  /**
   * Hands the work of a job a busy semaphore or an open breaker turned away to a new job that starts in `delayMs`.
   * The continuation's id is `{jobId}-r{n}` with n one above the current suffix; the caller then completes the
   * current job, because Vendure's job API cannot move a running job to delayed (D103).
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- see `add`
  requeueWithDelay<Data extends DurableJobData>(name: QueueName, data: Data, delayMs: number): Promise<void> {
    return this.add(name, { ...data, jobId: continuationJobId(data.jobId), delayMs });
  }
}
