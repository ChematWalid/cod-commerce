import { CATALOG_IMPORT_ERROR_CODES, EXPORT_MAX_ROWS } from '@cod/shared';
import { RUNNABLE_JOB_STATUSES } from '../domain/job-kinds';
import { exportFileKey } from '../domain/object-keys';
import { type ExportTarget, percentOf } from '../domain/export-target';
import type { StoreScope } from '../domain/store-scope';
import { filteredIds } from './export-ids';
import type { ExportFile, ExportFileBuilder } from './export-file.builder';
import type { CatalogExportReadsPort } from './ports/catalog-export-reads.port';
import type { ExportActivityPort } from './ports/export-activity.port';
import type { ExportJobRecord, ExportJobStore } from './ports/export-job.port';
import type { ObjectStorage } from './ports/object-storage.port';
import type { OperationContext } from './ports/operation-context';
import type { UnitOfWorkPort } from './ports/unit-of-work.port';

/** What {@link RunExportJobService} runs through. */
export interface RunExportJobDeps {
  readonly reads: Pick<CatalogExportReadsPort, 'idsPage'>;
  readonly files: Pick<ExportFileBuilder, 'build'>;
  readonly storage: Pick<ObjectStorage, 'write'>;
  readonly jobs: ExportJobStore;
  readonly units: UnitOfWorkPort;
  readonly activity: ExportActivityPort;
  readonly now?: () => Date;
}

/**
 * The `product-export` handler of the `imports-exports` queue (D2211, D2212): runs a `queued` export row of the
 * job's store (scope and actor from the row), writes progress after each batch, writes the file to its key (a rerun
 * overwrites it, harmless), then ends the row `done` with its activity row in one transaction. A filter that now finds
 * more than {@link EXPORT_MAX_ROWS} products ends the row `failed` with `catalog-import.too-many-rows`.
 */
export class RunExportJobService {
  private readonly now: () => Date;

  constructor(private readonly deps: RunExportJobDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** Runs the export row `recordId` of the scope's store; a row that is gone or over is left alone. */
  async run(ctx: OperationContext, scope: StoreScope, recordId: string): Promise<void> {
    const job = await this.deps.jobs.byId(ctx, scope, recordId);
    if (job === undefined || !RUNNABLE_JOB_STATUSES.includes(job.status)) return;
    await this.deps.jobs.markRunning(ctx, scope, job.id, this.now());
    const productIds = await this.idsOf(ctx, scope, job.target);
    if (productIds === undefined) {
      await this.deps.jobs.fail(ctx, scope, job.id, {
        errorCode: CATALOG_IMPORT_ERROR_CODES.TOO_MANY_ROWS,
        at: this.now(),
      });
      return;
    }
    const file = await this.deps.files.build(ctx, scope, {
      productIds,
      fields: job.fields,
      format: job.format,
      onProgress: (done) => this.deps.jobs.setProgress(ctx, scope, job.id, percentOf(done, productIds.length)),
    });
    await this.deps.storage.write(exportFileKey(scope, job.id), file.bytes, file.contentType);
    await this.finish(ctx, scope, { job, file });
  }

  private idsOf(
    ctx: OperationContext,
    scope: StoreScope,
    target: ExportTarget,
  ): Promise<readonly string[] | undefined> {
    if (target.kind === 'selected') return Promise.resolve(target.productIds);
    return filteredIds(this.deps.reads, ctx, scope, { filter: target.filter, limit: EXPORT_MAX_ROWS });
  }

  /** Ends the row `done` and records the export for the actor stored on the row (no request: no ip or agent). */
  private async finish(
    ctx: OperationContext,
    scope: StoreScope,
    done: { readonly job: ExportJobRecord; readonly file: ExportFile },
  ): Promise<void> {
    const { job, file } = done;
    const actorId = job.actorAdministratorId;
    await this.deps.units.run(ctx, scope, async (tx) => {
      await this.deps.jobs.finish(tx, scope, job.id, {
        rowCount: file.rowCount,
        skippedPacks: file.skippedPacks,
        at: this.now(),
      });
      if (actorId === null) return;
      await this.deps.activity.recordExport(tx, {
        scope,
        exportId: job.id,
        exportScope: job.target.kind,
        format: job.format,
        rowCount: file.rowCount,
        skippedPacks: file.skippedPacks,
        actor: { administratorId: actorId, ip: null, userAgent: null },
      });
    });
  }
}
