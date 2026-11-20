import type { DueJob, ReconcileSource } from '@cod/plugin-platform-jobs';
import { QUEUES, toBusinessId, toStoreId } from '@cod/shared';
import type {
  DueJobCursor,
  DueJobRow,
  JobRef,
  JobRepositoryPort,
  JobScanPort,
} from '../application/ports/job-repository.port';
import type { ImportLogger } from '../application/ports/logger.port';
import { IMPORTS_EXPORTS_QUEUE, JOB_ERROR_CODES, REQUEUE_STALE_MS, RUNNING_STALE_MS } from '../domain/constants';
import { jobDataOf, REQUEUE_JOB_STATUSES, tableOfKind } from '../domain/job-kinds';
import type { StoreScope } from '../domain/store-scope';

/** What the source reads and writes through. */
export interface ImportJobsReconcileDeps {
  readonly scan: Pick<JobScanPort, 'dueJobs'>;
  readonly jobs: Pick<JobRepositoryPort, 'markFailed' | 'touch'>;
  readonly logger: ImportLogger;
}

const RUNNING = 'running';
/** The queue's attempts: a `running` row past its stale time counts as having used them all, so it ends failed. */
const ALL_ATTEMPTS = QUEUES[IMPORTS_EXPORTS_QUEUE].attempts;

function dueJobOf(row: DueJobRow): DueJob {
  const running = row.status === RUNNING;
  return {
    queue: IMPORTS_EXPORTS_QUEUE,
    data: jobDataOf(row),
    attempts: running ? ALL_ATTEMPTS : 0,
    stuckSince: row.updatedAt,
    nextAttemptAt: running ? row.updatedAt : null,
  };
}

/** The row a due job came from; its data was built from the row, so its scope is the row's. */
function rowOf(job: DueJob): { scope: StoreScope; ref: JobRef } | undefined {
  const table = tableOfKind(String(job.data['kind']));
  if (table === undefined) return undefined;
  return {
    scope: {
      businessId: toBusinessId(String(job.data['businessId'])),
      storeId: toStoreId(String(job.data['storeId'])),
    },
    ref: { table, id: String(job.data['recordId']) },
  };
}

function cursorOf(after: DueJob | undefined): DueJobCursor | undefined {
  const row = after === undefined ? undefined : rowOf(after);
  return row === undefined || after === undefined ? undefined : { updatedAt: after.stuckSince, ...row.ref };
}

/**
 * The `catalog-import-jobs` source of the platform's job reconciler (D2212, D105): a `confirming` import or `queued`
 * export untouched for 2 minutes is re-enqueued when BullMQ lost its job; a `running` row untouched for 30 minutes
 * is failed `STALLED`.
 */
export class ImportJobsReconcileSource implements ReconcileSource {
  readonly name = 'catalog-import-jobs';

  constructor(private readonly deps: ImportJobsReconcileDeps) {}

  async findDue(now: Date, limit: number, after?: DueJob): Promise<readonly DueJob[]> {
    const rows = await this.deps.scan.dueJobs({
      limit,
      requeueBefore: new Date(now.getTime() - REQUEUE_STALE_MS),
      failBefore: new Date(now.getTime() - RUNNING_STALE_MS),
      requeueStatuses: REQUEUE_JOB_STATUSES,
      after: cursorOf(after),
    });
    return rows.map(dueJobOf);
  }

  async markEnqueued(jobs: readonly DueJob[], now: Date): Promise<void> {
    for (const row of jobs.map(rowOf)) {
      if (row !== undefined) await this.deps.jobs.touch(row.scope, row.ref, now);
    }
  }

  async markExhausted(jobs: readonly DueJob[], now: Date): Promise<void> {
    for (const row of jobs.map(rowOf)) {
      if (row === undefined) continue;
      await this.deps.jobs.markFailed(row.scope, row.ref, { errorCode: JOB_ERROR_CODES.STALLED, at: now });
      this.deps.logger.warn(`Failed stalled ${row.ref.table} job ${row.ref.id}`);
    }
  }
}
