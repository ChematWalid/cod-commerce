import {
  isLastAttempt,
  type JobAttempt,
  type PlatformQueues,
  SemaphoreBusyError,
  type SemaphoreKey,
  semaphoreRetryDelayMs,
} from '@cod/plugin-platform-jobs';
import { isSnowflake, toBusinessId } from '@cod/shared';
import type { JobRowSource } from '../application/ports/job-repository.port';
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
  /** The row source of a kind catalog-import stores itself, or undefined (D2252). */
  readonly ownRows: (kind: string) => JobRowSource | undefined;
  readonly logger: ImportLogger;
  readonly random?: () => number;
  readonly now?: () => Date;
}

/** A kind's handler and the source of its rows. */
interface Registration {
  readonly handler: ImportsExportsHandler;
  readonly rows: JobRowSource;
}

/**
 * The `imports-exports` queue's processor (D2212): one handler per `kind`, one job per business at a time
 * (`BusinessSemaphore`, limit 1; busy → re-queued 5-30 s later), each job opened from its row first, through the
 * kind's row source (D2252). A handler that fails on its last attempt leaves the row `failed` with a fixed code,
 * then rethrows so BullMQ records it.
 */
export class ImportsExportsJobRegistry {
  private readonly registrations = new Map<string, Registration>();

  constructor(private readonly deps: JobRegistryDeps) {}

  /**
   * Adds the handler of `kind`, opened from `rows`; a kind catalog-import stores defaults to its own table.
   * @throws Error when the kind already has a handler, or has no row source
   */
  register(kind: string, handler: ImportsExportsHandler, rows?: JobRowSource): void {
    if (this.registrations.has(kind)) throw new Error(`The imports-exports kind "${kind}" already has a handler`);
    const source = rows ?? this.deps.ownRows(kind);
    if (source === undefined) {
      throw new Error(`The imports-exports kind "${kind}" needs a row source: catalog-import stores none of its rows`);
    }
    this.registrations.set(kind, { handler, rows: source });
  }

  /** Runs one job; the queue's processor. */
  async run(data: ImportsExportsJobData, attempt: JobAttempt): Promise<void> {
    const registration = this.registrations.get(data.kind);
    if (registration === undefined) {
      this.deps.logger.error(`Dropped an imports-exports job ${data.jobId}: no handler for its kind`);
      return;
    }
    if (!isSnowflake(data.businessId)) {
      this.deps.logger.error(`Dropped an imports-exports job ${data.jobId}: its payload business id is malformed`);
      return;
    }
    const key = { queue: IMPORTS_EXPORTS_QUEUE, businessId: toBusinessId(data.businessId) };
    try {
      await this.deps.semaphore.withBusinessSemaphore(key, IMPORTS_EXPORTS_BUSINESS_LIMIT, () =>
        this.runOpened(data, attempt, registration),
      );
    } catch (error: unknown) {
      if (!(error instanceof SemaphoreBusyError)) throw error;
      const delayMs = semaphoreRetryDelayMs(this.deps.random ?? Math.random);
      await this.deps.queues.requeueWithDelay(IMPORTS_EXPORTS_QUEUE, data, delayMs);
    }
  }

  private async runOpened(data: ImportsExportsJobData, attempt: JobAttempt, registration: Registration): Promise<void> {
    const lastAttempt = isLastAttempt(attempt);
    const opened = await this.deps.stores.open(data, registration.rows, lastAttempt);
    if (opened === undefined) return;
    try {
      await registration.handler(data, opened.ctx, opened.scope);
    } catch (error: unknown) {
      if (lastAttempt) await this.failRow(registration.rows, opened);
      throw error;
    }
  }

  private async failRow(rows: JobRowSource, opened: OpenedJob): Promise<void> {
    const at = (this.deps.now ?? (() => new Date()))();
    await rows.markFailed(opened.scope, opened.recordId, { errorCode: JOB_ERROR_CODES.FAILED, at });
  }
}
