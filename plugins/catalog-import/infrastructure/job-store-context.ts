import { CATALOG_ERROR_CODES, DomainError, isSnowflake, toBusinessId, toStoreId } from '@cod/shared';
import type { CatalogProductsPort } from '../application/ports/catalog-products.port';
import type { JobRowScope, JobRowSource } from '../application/ports/job-repository.port';
import type { ImportLogger } from '../application/ports/logger.port';
import type { OperationContext } from '../application/ports/operation-context';
import { JOB_ERROR_CODES, type JobErrorCode } from '../domain/constants';
import type { ImportsExportsJobData } from '../domain/imports-exports-job';
import { RUNNABLE_JOB_STATUSES, TERMINAL_JOB_STATUSES } from '../domain/job-kinds';
import type { StoreScope } from '../domain/store-scope';

/** A job the worker may run: the store-channel context, the scope and actor of the row, and the row's id. */
export interface OpenedJob {
  readonly ctx: OperationContext;
  readonly scope: StoreScope;
  readonly recordId: string;
  readonly actorAdministratorId: number | null;
}

/** The row a job names, read through its kind's {@link JobRowSource}. */
interface JobRow {
  readonly data: ImportsExportsJobData;
  readonly rows: JobRowSource;
  readonly scope: JobRowScope;
}

/** What {@link JobStoreContext} reads and writes through; the rows come with each job's kind. */
export interface JobStoreContextDeps {
  readonly catalog: Pick<CatalogProductsPort, 'storeContext'>;
  readonly logger: ImportLogger;
  readonly now?: () => Date;
}

const isStoreRefusal = (error: unknown): boolean =>
  error instanceof DomainError && error.code === CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND;

/**
 * Opens a queued `imports-exports` job (D2212, D2252): loads its row by id through the kind's row source, takes the
 * scope and actor **from the row**, fails the row when the payload names another business or store (a BullMQ payload
 * is no tenant proof), and builds the store-channel context through catalog's facade (an archived store or suspended
 * business fails the row; any other failure is retried, and fails the row on the last attempt).
 */
export class JobStoreContext {
  private readonly now: () => Date;

  constructor(private readonly deps: JobStoreContextDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** The opened job, or undefined when it must not run (the reason is logged or stored on the row). */
  async open(data: ImportsExportsJobData, rows: JobRowSource, lastAttempt: boolean): Promise<OpenedJob | undefined> {
    if (!isSnowflake(data.recordId)) {
      this.deps.logger.error(`Dropped an imports-exports job ${data.jobId}: its record id is malformed`);
      return undefined;
    }
    const scope = await rows.rowScopeOf(data.recordId);
    if (scope === undefined) {
      this.deps.logger.error(`Dropped an imports-exports job ${data.jobId}: its row is gone`);
      return undefined;
    }
    return this.openRow({ data, rows, scope }, lastAttempt);
  }

  private async openRow(row: JobRow, lastAttempt: boolean): Promise<OpenedJob | undefined> {
    const { data, scope: rowScope } = row;
    if (!RUNNABLE_JOB_STATUSES.includes(rowScope.status)) {
      if (!TERMINAL_JOB_STATUSES.includes(rowScope.status)) {
        this.deps.logger.warn(`Dropped an imports-exports job ${data.jobId}: its row is not runnable`);
      }
      return undefined;
    }
    const scope: StoreScope = { businessId: toBusinessId(rowScope.businessId), storeId: toStoreId(rowScope.storeId) };
    if (data.businessId !== rowScope.businessId || data.storeId !== rowScope.storeId) {
      return this.fail(row, scope, JOB_ERROR_CODES.SCOPE_MISMATCH);
    }
    const ctx = await this.storeContextOf(row, scope, lastAttempt);
    if (ctx === undefined) return this.fail(row, scope, JOB_ERROR_CODES.STORE_UNAVAILABLE);
    return { ctx, scope, recordId: data.recordId, actorAdministratorId: rowScope.actorAdministratorId };
  }

  /**
   * The store's context, or undefined when catalog refuses the store. Any other failure propagates so the job is
   * retried; on the last attempt it fails the row first, so the row never waits for a run that will not come.
   */
  private async storeContextOf(
    row: JobRow,
    scope: StoreScope,
    lastAttempt: boolean,
  ): Promise<OperationContext | undefined> {
    try {
      return await this.deps.catalog.storeContext(scope);
    } catch (error: unknown) {
      if (isStoreRefusal(error)) return undefined;
      if (lastAttempt) await this.fail(row, scope, JOB_ERROR_CODES.FAILED);
      throw error;
    }
  }

  private async fail(row: JobRow, scope: StoreScope, errorCode: JobErrorCode): Promise<undefined> {
    await row.rows.markFailed(scope, row.data.recordId, { errorCode, at: this.now() });
    this.deps.logger.warn(`Failed ${row.data.kind} job ${row.data.recordId}: ${errorCode}`);
    return undefined;
  }
}
