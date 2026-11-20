import { CATALOG_ERROR_CODES, DomainError, isSnowflake, toBusinessId, toStoreId } from '@cod/shared';
import type { CatalogProductsPort } from '../application/ports/catalog-products.port';
import type { JobRef, JobRepositoryPort, JobRowScope, JobScanPort } from '../application/ports/job-repository.port';
import type { ImportLogger } from '../application/ports/logger.port';
import type { OperationContext } from '../application/ports/operation-context';
import { JOB_ERROR_CODES, type JobErrorCode } from '../domain/constants';
import type { ImportsExportsJobData } from '../domain/imports-exports-job';
import { RUNNABLE_JOB_STATUSES, tableOfKind, TERMINAL_JOB_STATUSES } from '../domain/job-kinds';
import type { StoreScope } from '../domain/store-scope';

/** A job the worker may run: the store-channel context, the scope and actor of the row, and the row itself. */
export interface OpenedJob {
  readonly ctx: OperationContext;
  readonly scope: StoreScope;
  readonly ref: JobRef;
  readonly actorAdministratorId: number | null;
}

/** What {@link JobStoreContext} reads and writes through. */
export interface JobStoreContextDeps {
  readonly scan: Pick<JobScanPort, 'rowScopeOf'>;
  readonly jobs: Pick<JobRepositoryPort, 'markFailed'>;
  readonly catalog: Pick<CatalogProductsPort, 'storeContext'>;
  readonly logger: ImportLogger;
  readonly now?: () => Date;
}

const isStoreRefusal = (error: unknown): boolean =>
  error instanceof DomainError && error.code === CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND;

/**
 * Opens a queued `imports-exports` job (D2212): loads its row by id, takes the scope and actor **from the row**,
 * fails the row when the payload names another business or store (a BullMQ payload is no tenant proof), and builds
 * the store-channel context through catalog's facade (an archived store or suspended business fails the row).
 */
export class JobStoreContext {
  private readonly now: () => Date;

  constructor(private readonly deps: JobStoreContextDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** The opened job, or undefined when it must not run (the reason is logged or stored on the row). */
  async open(data: ImportsExportsJobData): Promise<OpenedJob | undefined> {
    const table = tableOfKind(data.kind);
    if (table === undefined || !isSnowflake(data.recordId)) {
      this.deps.logger.error(`Dropped an imports-exports job ${data.jobId}: no job row kind or id`);
      return undefined;
    }
    const ref: JobRef = { table, id: data.recordId };
    const row = await this.deps.scan.rowScopeOf(ref);
    if (row === undefined) {
      this.deps.logger.error(`Dropped an imports-exports job ${data.jobId}: its row is gone`);
      return undefined;
    }
    return this.openRow(data, ref, row);
  }

  private async openRow(data: ImportsExportsJobData, ref: JobRef, row: JobRowScope): Promise<OpenedJob | undefined> {
    if (!RUNNABLE_JOB_STATUSES.includes(row.status)) {
      if (!TERMINAL_JOB_STATUSES.includes(row.status)) {
        this.deps.logger.warn(`Dropped an imports-exports job ${data.jobId}: its row is not runnable`);
      }
      return undefined;
    }
    const scope: StoreScope = { businessId: toBusinessId(row.businessId), storeId: toStoreId(row.storeId) };
    if (data.businessId !== row.businessId || data.storeId !== row.storeId) {
      return this.fail(scope, ref, JOB_ERROR_CODES.SCOPE_MISMATCH);
    }
    const ctx = await this.storeContextOf(scope);
    if (ctx === undefined) return this.fail(scope, ref, JOB_ERROR_CODES.STORE_UNAVAILABLE);
    return { ctx, scope, ref, actorAdministratorId: row.actorAdministratorId };
  }

  /** The store's context, or undefined when catalog refuses the store; any other failure propagates (retry). */
  private async storeContextOf(scope: StoreScope): Promise<OperationContext | undefined> {
    try {
      return await this.deps.catalog.storeContext(scope);
    } catch (error: unknown) {
      if (isStoreRefusal(error)) return undefined;
      throw error;
    }
  }

  private async fail(scope: StoreScope, ref: JobRef, errorCode: JobErrorCode): Promise<undefined> {
    await this.deps.jobs.markFailed(scope, ref, { errorCode, at: this.now() });
    this.deps.logger.warn(`Failed ${ref.table} job ${ref.id}: ${errorCode}`);
    return undefined;
  }
}
