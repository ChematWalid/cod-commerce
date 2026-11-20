import type { JobTable } from '../../domain/job-kinds';
import type { StoreScope } from '../../domain/store-scope';

export type { JobTable };

/** One job row: its table and snowflake id. */
export interface JobRef {
  readonly table: JobTable;
  readonly id: string;
}

/** What a worker reads of a row before it trusts a job (D2212): the scope, status and actor are the row's. */
export interface JobRowScope {
  readonly businessId: string;
  readonly storeId: string;
  readonly status: string;
  readonly actorAdministratorId: number | null;
}

/** A row the reconciler looks at, oldest `updatedAt` first. */
export interface DueJobRow {
  readonly table: JobTable;
  readonly id: string;
  readonly businessId: string;
  readonly storeId: string;
  readonly status: string;
  readonly updatedAt: Date;
}

/** The keyset cursor after the last row of the previous batch. */
export interface DueJobCursor {
  readonly updatedAt: Date;
  readonly table: JobTable;
  readonly id: string;
}

/** Which rows are due: rows in `requeueStatuses` untouched since `requeueBefore`, `running` ones since `failBefore`. */
export interface DueJobQuery {
  readonly limit: number;
  readonly requeueBefore: Date;
  readonly failBefore: Date;
  readonly requeueStatuses: readonly string[];
  readonly after?: DueJobCursor;
}

/** How a job ended badly: a fixed code, never exception text (D2210). */
export interface JobFailure {
  readonly errorCode: string;
  readonly at: Date;
}

/**
 * The platform's reads of job rows across businesses (D2212): the worker loads a row by id before it knows the
 * scope, the reconciler finds lost rows. They return ids, scope, status and times only; every write that follows
 * goes through {@link JobRepositoryPort} under the row's own scope.
 */
export interface JobScanPort {
  /** The row's scope, status and actor, or undefined when there is no such row. */
  rowScopeOf(ref: JobRef): Promise<JobRowScope | undefined>;
  /** Due rows of both tables, oldest first, at most `query.limit`. */
  dueJobs(query: DueJobQuery): Promise<readonly DueJobRow[]>;
}

/** Tenant-scoped writes of the job state machine shared by every handler (ADR 0002). */
export interface JobRepositoryPort {
  /** Ends a row that is not done or failed yet as `failed` with `failure.errorCode`; another scope's row is left. */
  markFailed(scope: StoreScope, ref: JobRef, failure: JobFailure): Promise<void>;
  /** Records that the row was handed to the queue again at `at`. */
  touch(scope: StoreScope, ref: JobRef, at: Date): Promise<void>;
}
