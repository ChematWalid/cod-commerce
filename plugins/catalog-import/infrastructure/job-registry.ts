import {
  isLastAttempt,
  type JobAttempt,
  type PlatformQueues,
  SemaphoreBusyError,
  type SemaphoreKey,
  semaphoreRetryDelayMs,
} from '@cod/plugin-platform-jobs';
import { isSnowflake, toBusinessId } from '@cod/shared';
import type { JobRepositoryPort } from '../application/ports/job-repository.port';
import type { ImportLogger } from '../application/ports/logger.port';
import type { OperationContext } from '../application/ports/operation-context';
import { IMPORTS_EXPORTS_BUSINESS_LIMIT, IMPORTS_EXPORTS_QUEUE, JOB_ERROR_CODES } from '../domain/constants';
import type { ImportsExportsJobData } from '../domain/imports-exports-job';
import type { StoreScope } from '../domain/store-scope';
import type { JobStoreContext, OpenedJob } from './job-store-context';

/** The handler of one job kind: it runs in the row's store context and scope, never the payload's. */
export type ImportsExportsHandler = (
  data: ImportsExportsJobData,
  ctx: OperationContext,
  scope: StoreScope,
) => Promise<void>;

/** The part of `BusinessSemaphore` the registry uses: a job's work returns nothing. */
export interface JobSemaphore {
  withBusinessSemaphore(key: SemaphoreKey, limit: number, work: () => Promise<void>): Promise<void>;
}

/** What {@link ImportsExportsJobRegistry} runs through. */
export interface JobRegistryDeps {
  readonly semaphore: JobSemaphore;
  readonly queues: Pick<PlatformQueues, 'requeueWithDelay'>;
  readonly stores: Pick<JobStoreContext, 'open'>;
  readonly jobs: Pick<JobRepositoryPort, 'markFailed'>;
  readonly logger: ImportLogger;
  readonly random?: () => number;
  readonly now?: () => Date;
}

/**
 * The `imports-exports` queue's processor (D2212): one handler per `kind`, one job per business at a time
 * (`BusinessSemaphore`, limit 1; busy → re-queued 5-30 s later), each job opened from its row first. A handler that
 * fails on its last attempt leaves the row `failed` with a fixed code, then rethrows so BullMQ records it.
 */
export class ImportsExportsJobRegistry {
  private readonly handlers = new Map<string, ImportsExportsHandler>();

  constructor(private readonly deps: JobRegistryDeps) {}

  /**
   * Adds the handler of `kind`.
   * @throws Error when the kind already has one
   */
  register(kind: string, handler: ImportsExportsHandler): void {
    if (this.handlers.has(kind)) throw new Error(`The imports-exports kind "${kind}" already has a handler`);
    this.handlers.set(kind, handler);
  }

  /** Runs one job; the queue's processor. */
  async run(data: ImportsExportsJobData, attempt: JobAttempt): Promise<void> {
    const handler = this.handlers.get(data.kind);
    if (handler === undefined || !isSnowflake(data.businessId)) {
      this.deps.logger.error(`Dropped an imports-exports job ${data.jobId}: no handler for its kind`);
      return;
    }
    const key = { queue: IMPORTS_EXPORTS_QUEUE, businessId: toBusinessId(data.businessId) };
    try {
      await this.deps.semaphore.withBusinessSemaphore(key, IMPORTS_EXPORTS_BUSINESS_LIMIT, () =>
        this.runOpened(data, attempt, handler),
      );
    } catch (error: unknown) {
      if (!(error instanceof SemaphoreBusyError)) throw error;
      const delayMs = semaphoreRetryDelayMs(this.deps.random ?? Math.random);
      await this.deps.queues.requeueWithDelay(IMPORTS_EXPORTS_QUEUE, data, delayMs);
    }
  }

  private async runOpened(
    data: ImportsExportsJobData,
    attempt: JobAttempt,
    handler: ImportsExportsHandler,
  ): Promise<void> {
    const opened = await this.deps.stores.open(data);
    if (opened === undefined) return;
    try {
      await handler(data, opened.ctx, opened.scope);
    } catch (error: unknown) {
      if (isLastAttempt(attempt)) await this.failRow(opened);
      throw error;
    }
  }

  private async failRow(opened: OpenedJob): Promise<void> {
    const at = (this.deps.now ?? (() => new Date()))();
    await this.deps.jobs.markFailed(opened.scope, opened.ref, { errorCode: JOB_ERROR_CODES.FAILED, at });
  }
}
