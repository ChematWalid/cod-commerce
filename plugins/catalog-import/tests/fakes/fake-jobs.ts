import type {
  DueJobQuery,
  DueJobRow,
  JobFailure,
  JobRef,
  JobRepositoryPort,
  JobRowScope,
  JobScanPort,
} from '../../application/ports/job-repository.port';
import type { StoreScope } from '../../domain/store-scope';

/** A job row as the fakes hold it. */
export interface FakeJobRow extends DueJobRow {
  readonly actorAdministratorId: number | null;
}

const sameRef = (row: DueJobRow, ref: JobRef): boolean => row.table === ref.table && row.id === ref.id;

/** Both job ports over one array, applying the same cut-offs and order as the Postgres scan. */
export class FakeJobs implements JobScanPort, JobRepositoryPort {
  readonly failed: { scope: StoreScope; ref: JobRef; failure: JobFailure }[] = [];
  readonly touched: { scope: StoreScope; ref: JobRef; at: Date }[] = [];

  constructor(public rows: FakeJobRow[] = []) {}

  rowScopeOf(ref: JobRef): Promise<JobRowScope | undefined> {
    const row = this.rows.find((candidate) => sameRef(candidate, ref));
    if (row === undefined) return Promise.resolve(undefined);
    return Promise.resolve({
      businessId: row.businessId,
      storeId: row.storeId,
      status: row.status,
      actorAdministratorId: row.actorAdministratorId,
    });
  }

  dueJobs(query: DueJobQuery): Promise<readonly DueJobRow[]> {
    const due = this.rows.filter((row) =>
      row.status === 'running'
        ? row.updatedAt.getTime() <= query.failBefore.getTime()
        : query.requeueStatuses.includes(row.status) && row.updatedAt.getTime() <= query.requeueBefore.getTime(),
    );
    return Promise.resolve(
      due.sort((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime()).slice(0, query.limit),
    );
  }

  markFailed(scope: StoreScope, ref: JobRef, failure: JobFailure): Promise<void> {
    this.failed.push({ scope, ref, failure });
    return Promise.resolve();
  }

  touch(scope: StoreScope, ref: JobRef, at: Date): Promise<void> {
    this.touched.push({ scope, ref, at });
    return Promise.resolve();
  }
}

/** A logger that keeps what it was told. */
export class RecordingLogger {
  readonly errors: string[] = [];
  readonly warnings: string[] = [];

  error(message: string): void {
    this.errors.push(message);
  }

  warn(message: string): void {
    this.warnings.push(message);
  }
}
