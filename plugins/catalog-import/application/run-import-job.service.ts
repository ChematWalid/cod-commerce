import { DomainError } from '@cod/shared';
import { IMPORT_PROGRESS_EVERY_ROWS, IMPORT_SKU_LOOKUP_BATCH } from '../domain/constants';
import { RowProductNotFoundError, RowSkuTakenError } from '../domain/errors';
import { percentOf } from '../domain/export-target';
import { createOf, imageUrlsOf, skusOfCreate, updateOf } from '../domain/import-writes';
import { RUNNABLE_JOB_STATUSES } from '../domain/job-kinds';
import { writeGroupKeyOf } from '../domain/row-groups';
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
  readonly catalog: Pick<CatalogImportPort, 'findBySkus' | 'product' | 'create' | 'update'>;
  readonly origins: ProductOriginWrites;
  readonly activity: ImportActivityPort;
  readonly report: Pick<ImportReportService, 'write'>;
  readonly units: UnitOfWorkPort;
  readonly now?: () => Date;
}

/** The rows of one product: never empty. */
type StoredGroupRows = readonly [StoredImportRow, ...StoredImportRow[]];

/** The rows of one product, in row order, grouped as the preview planned them (`writeGroupKeyOf`, D2268). */
function groupsOf(rows: readonly StoredImportRow[]): StoredGroupRows[] {
  const groups = new Map<string, StoredGroupRows>();
  for (const row of rows) {
    const key = writeGroupKeyOf(row);
    const group = groups.get(key);
    groups.set(key, group === undefined ? [row] : [...group, row]);
  }
  return [...groups.values()];
}

const numbersOf = (rows: readonly PlannedRow[]): number[] => rows.map((row) => row.rowNumber);

/**
 * The `product-import` handler of the `imports-exports` queue (D2210, D2212): runs a `confirming` import of the job's
 * store (scope and actor from the row) and applies exactly the stored rows not applied yet, one product group per
 * facade call (`createWithVariants` or `update`). Each group's write, its rows' `applied` mark and its origin row
 * commit in one transaction, so a retried or re-enqueued job skips them (Review Focus 6); a catalog refusal rolls the
 * group back and marks its rows failed with the refusal's code, rows refused before the write keeping their own
 * (D2286). A create group whose SKU a product of the store took since the preview (another import of the same file,
 * run first by the business semaphore) is refused, not created twice (D2285). Progress is written every 50 rows; at
 * the end the error report is written and the row ends `done` with its activity row.
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
    const groups = groupsOf(pending);
    const taken = await this.takenSkus(ctx, scope, groups);
    for (const group of groups) {
      await this.applyGroup(ctx, scope, { jobId: job.id, rows: group, taken });
      processed += group.length;
      if (processed - reported >= IMPORT_PROGRESS_EVERY_ROWS) {
        await this.deps.jobs.setProgress(ctx, scope, job.id, percentOf(processed, job.rowCount));
        reported = processed;
      }
    }
    await this.finish(ctx, scope, job);
  }

  /**
   * Applies one group in its own transaction; a domain refusal fails its rows instead, in a new one: rows the group
   * refused before the write keep their own reason, the others take the refusal's code (D2286).
   */
  private async applyGroup(ctx: OperationContext, scope: StoreScope, group: ImportGroup): Promise<void> {
    const refusals = new Map<number, string>();
    try {
      await this.deps.units.run(ctx, scope, (tx) => this.applyIn(tx, scope, { ...group, refusals }));
    } catch (error: unknown) {
      if (!(error instanceof DomainError)) throw error;
      await this.deps.units.run(ctx, scope, (tx) => this.markFailed(tx, scope, { ...group, refusals }, error.code));
    }
  }

  private async markFailed(tx: OperationContext, scope: StoreScope, group: GroupRun, code: string): Promise<void> {
    const failures = new Map<string, number[]>();
    for (const { rowNumber } of group.rows) {
      const failure = group.refusals.get(rowNumber) ?? code;
      failures.set(failure, [...(failures.get(failure) ?? []), rowNumber]);
    }
    for (const [failure, rowNumbers] of failures) {
      await this.deps.rows.markApplied(tx, scope, { jobId: group.jobId, rowNumbers, productId: null, failure });
    }
  }

  private async applyIn(tx: OperationContext, scope: StoreScope, group: GroupRun): Promise<void> {
    const [first] = group.rows;
    if (first.action === 'create') await this.create(tx, scope, group);
    else await this.update(tx, scope, { ...group, productId: first.productId ?? '' });
  }

  /** Creates the group's product, unless one of its SKUs names a product of the store now (D2285). */
  private async create(tx: OperationContext, scope: StoreScope, group: ImportGroup): Promise<void> {
    const command = createOf(group.rows);
    if (skusOfCreate(command).some((sku) => group.taken.has(sku))) throw new RowSkuTakenError();
    const productId = await this.deps.catalog.create(tx, scope, command);
    await this.deps.rows.markApplied(tx, scope, { jobId: group.jobId, rowNumbers: numbersOf(group.rows), productId });
    const origin = { productId, importJobId: group.jobId, imageUrls: imageUrlsOf(group.rows), created: true };
    await this.deps.origins.recordImport(tx, scope, origin);
  }

  /**
   * The SKUs of the create groups that name a product of the store when the run starts (D2285), looked up 200 at a
   * time. The run holds the business semaphore, so no other import of the store writes until it ends; the file's own
   * groups never share a SKU (the preview refuses a repeat, D2268).
   */
  private async takenSkus(
    ctx: OperationContext,
    scope: StoreScope,
    groups: readonly StoredGroupRows[],
  ): Promise<ReadonlySet<string>> {
    const skus = [
      ...new Set(groups.flatMap((rows) => (rows[0].action === 'create' ? skusOfCreate(createOf(rows)) : []))),
    ];
    const taken = new Set<string>();
    for (let start = 0; start < skus.length; start += IMPORT_SKU_LOOKUP_BATCH) {
      const matches = await this.deps.catalog.findBySkus(
        ctx,
        scope,
        skus.slice(start, start + IMPORT_SKU_LOOKUP_BATCH),
      );
      for (const [sku, match] of matches) if (match.kind !== 'none') taken.add(sku);
    }
    return taken;
  }

  /** Re-reads the product (a row naming one no longer in the store fails) and places each row on a live variant. */
  private async update(
    tx: OperationContext,
    scope: StoreScope,
    group: GroupRun & { productId: string },
  ): Promise<void> {
    const target = await this.deps.catalog.product(tx, scope, group.productId);
    if (target === undefined) throw new RowProductNotFoundError();
    const { update, refused } = updateOf(group.rows, target);
    for (const [rowNumber, failure] of refused) {
      group.refusals.set(rowNumber, failure);
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
  readonly rows: StoredGroupRows;
  /** The create SKUs a product of the store already holds (D2285). */
  readonly taken: ReadonlySet<string>;
}

/** A group being applied, with the reasons of the rows it refused before the write (filled as they are found). */
interface GroupRun extends ImportGroup {
  readonly refusals: Map<number, string>;
}
