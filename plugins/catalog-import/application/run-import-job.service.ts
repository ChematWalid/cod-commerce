import { DomainError } from '@cod/shared';
import { IMPORT_PROGRESS_EVERY_ROWS } from '../domain/constants';
import { RowProductNotFoundError } from '../domain/errors';
import { percentOf } from '../domain/export-target';
import { createOf, imageUrlsOf, updateOf } from '../domain/import-writes';
import { RUNNABLE_JOB_STATUSES } from '../domain/job-kinds';
import type { PlannedRow } from '../domain/row-plan';
import type { StoreScope } from '../domain/store-scope';
import type { ImportReportService } from './import-report.service';
import type { CatalogImportPort, ImportActivityPort, ProductOriginWrites } from './ports/catalog-import.port';
import type { ImportJobRecord, ImportJobStore } from './ports/import-job.port';
import type { ImportRowStore, StoredImportRow } from './ports/import-row.port';
import type { OperationContext } from './ports/operation-context';
import type { UnitOfWorkPort } from './ports/unit-of-work.port';

/** What {@link RunImportJobService} runs through. */
export interface RunImportJobDeps {
  readonly jobs: Pick<ImportJobStore, 'byId' | 'markRunning' | 'setProgress' | 'finish'>;
  readonly rows: Pick<ImportRowStore, 'pending' | 'failed' | 'markApplied' | 'resultOf'>;
  readonly catalog: Pick<CatalogImportPort, 'product' | 'create' | 'update'>;
  readonly origins: ProductOriginWrites;
  readonly activity: ImportActivityPort;
  readonly report: Pick<ImportReportService, 'write'>;
  readonly units: UnitOfWorkPort;
  readonly now?: () => Date;
}

/** The rows of one product, in row order: one product key, or a row without one. */
function groupsOf(rows: readonly StoredImportRow[]): StoredImportRow[][] {
  const groups = new Map<string, StoredImportRow[]>();
  for (const row of rows) {
    const key = row.productKey === null ? ` ${String(row.rowNumber)}` : `=${row.productKey}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()];
}

const numbersOf = (rows: readonly PlannedRow[]): number[] => rows.map((row) => row.rowNumber);

/**
 * The `product-import` handler of the `imports-exports` queue (D2210, D2212): runs a `confirming` import of the job's
 * store (scope and actor from the row) and applies exactly the stored rows not applied yet, one product group per
 * facade call (`createWithVariants` or `update`). Each group's write, its rows' `applied` mark and its origin row
 * commit in one transaction, so a retried or re-enqueued job skips them (Review Focus 6); a catalog refusal rolls the
 * group back and marks its rows failed with the refusal's code. Progress is written every 50 rows; at the end the
 * error report is written and the row ends `done` with its activity row.
 */
export class RunImportJobService {
  private readonly now: () => Date;

  constructor(private readonly deps: RunImportJobDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** Runs the import row `recordId` of the scope's store; a row that is gone or over is left alone. */
  async run(ctx: OperationContext, scope: StoreScope, recordId: string): Promise<void> {
    const job = await this.deps.jobs.byId(ctx, scope, recordId);
    if (job === undefined || !RUNNABLE_JOB_STATUSES.includes(job.status)) return;
    await this.deps.jobs.markRunning(ctx, scope, job.id, this.now());
    const pending = await this.deps.rows.pending(ctx, scope, job.id);
    let processed = job.rowCount - pending.length;
    let reported = processed;
    for (const group of groupsOf(pending)) {
      await this.applyGroup(ctx, scope, { jobId: job.id, rows: group });
      processed += group.length;
      if (processed - reported >= IMPORT_PROGRESS_EVERY_ROWS) {
        await this.deps.jobs.setProgress(ctx, scope, job.id, percentOf(processed, job.rowCount));
        reported = processed;
      }
    }
    await this.finish(ctx, scope, job);
  }

  /** Applies one group in its own transaction; a domain refusal fails its rows instead. */
  private async applyGroup(ctx: OperationContext, scope: StoreScope, group: ImportGroup): Promise<void> {
    try {
      await this.deps.units.run(ctx, scope, (tx) => this.applyIn(tx, scope, group));
    } catch (error: unknown) {
      if (!(error instanceof DomainError)) throw error;
      const refused = { jobId: group.jobId, rowNumbers: numbersOf(group.rows), productId: null, failure: error.code };
      await this.deps.units.run(ctx, scope, (tx) => this.deps.rows.markApplied(tx, scope, refused));
    }
  }

  private async applyIn(tx: OperationContext, scope: StoreScope, group: ImportGroup): Promise<void> {
    const [first] = group.rows;
    if (first === undefined) return;
    if (first.action === 'create') await this.create(tx, scope, group);
    else await this.update(tx, scope, { ...group, productId: first.productId ?? '' });
  }

  private async create(tx: OperationContext, scope: StoreScope, group: ImportGroup): Promise<void> {
    const productId = await this.deps.catalog.create(tx, scope, createOf(group.rows));
    await this.deps.rows.markApplied(tx, scope, { jobId: group.jobId, rowNumbers: numbersOf(group.rows), productId });
    const origin = { productId, importJobId: group.jobId, imageUrls: imageUrlsOf(group.rows), created: true };
    await this.deps.origins.recordImport(tx, scope, origin);
  }

  /** Re-reads the product (a row naming one no longer in the store fails) and places each row on a live variant. */
  private async update(
    tx: OperationContext,
    scope: StoreScope,
    group: ImportGroup & { productId: string },
  ): Promise<void> {
    const target = await this.deps.catalog.product(tx, scope, group.productId);
    if (target === undefined) throw new RowProductNotFoundError();
    const { update, refused } = updateOf(group.rows, target);
    for (const [rowNumber, failure] of refused) {
      await this.deps.rows.markApplied(tx, scope, {
        jobId: group.jobId,
        rowNumbers: [rowNumber],
        productId: null,
        failure,
      });
    }
    const placed = group.rows.filter((row) => !refused.has(row.rowNumber));
    if (placed.length === 0) return;
    await this.deps.catalog.update(tx, scope, group.productId, update);
    const productId = group.productId;
    await this.deps.rows.markApplied(tx, scope, { jobId: group.jobId, rowNumbers: numbersOf(placed), productId });
    const imageUrls = imageUrlsOf(placed);
    if (imageUrls.length === 0) return;
    await this.deps.origins.recordImport(tx, scope, { productId, importJobId: group.jobId, imageUrls, created: false });
  }

  /** Writes the error report, then ends the row `done` with its activity row in one transaction. */
  private async finish(ctx: OperationContext, scope: StoreScope, job: ImportJobRecord): Promise<void> {
    await this.deps.report.write(scope, job.id, await this.deps.rows.failed(ctx, scope, job.id));
    await this.deps.units.run(ctx, scope, async (tx) => {
      const result = await this.deps.rows.resultOf(tx, scope, job.id);
      await this.deps.jobs.finish(tx, scope, job.id, { result, at: this.now() });
      await this.deps.activity.recordImport(tx, {
        scope,
        importId: job.id,
        ...result,
        administratorId: job.actorAdministratorId,
      });
    });
  }
}

/** One product group of a job's pending rows. */
interface ImportGroup {
  readonly jobId: string;
  readonly rows: readonly StoredImportRow[];
}
