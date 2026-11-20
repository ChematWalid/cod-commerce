import {
  EXPORT_HEADER,
  EXPORT_MAX_ROWS,
  EXPORT_SYNC_MAX_ROWS,
  type ExportCommand,
  type ImportFieldKey,
} from '@cod/shared';
import { PROGRESS_DONE } from '../domain/constants';
import { TooManyRowsError } from '../domain/errors';
import { exportFilterOf, type ExportFilter, type ExportTarget } from '../domain/export-target';
import { exportFileKey } from '../domain/object-keys';
import type { StoreScope } from '../domain/store-scope';
import { filteredIds, firstIdsPage } from './export-ids';
import type { ExportFileBuilder } from './export-file.builder';
import { type ExportView, exportViewOf, type ExportViewDeps } from './export-view';
import type { CatalogExportReadsPort } from './ports/catalog-export-reads.port';
import type { ExportActivityPort } from './ports/export-activity.port';
import type { ExportJobStore, NewExportJob } from './ports/export-job.port';
import type { ExportQueuePort, JobIdGenerator } from './ports/export-queue.port';
import type { ObjectStorage } from './ports/object-storage.port';
import type { OperationContext } from './ports/operation-context';
import type { ActivityActor } from './ports/product-activity.port';
import type { UnitOfWorkPort } from './ports/unit-of-work.port';

/** What {@link ExportProductsService} runs through. */
export interface ExportProductsDeps extends ExportViewDeps {
  readonly reads: Pick<CatalogExportReadsPort, 'idsPage'>;
  readonly files: Pick<ExportFileBuilder, 'build'>;
  readonly storage: Pick<ObjectStorage, 'write' | 'presignGet'>;
  readonly jobs: Pick<ExportJobStore, 'create'>;
  readonly units: UnitOfWorkPort;
  readonly activity: ExportActivityPort;
  readonly queue: ExportQueuePort;
  readonly ids: JobIdGenerator;
  readonly now?: () => Date;
}

/** How a request's export runs: written now, for these ids, or handed to the worker. */
type ExportPlan =
  | { readonly mode: 'now'; readonly productIds: readonly string[] }
  | { readonly mode: 'job'; readonly filter: ExportFilter };

/** The export of one request, its ids and columns settled. */
interface ExportOrder {
  readonly id: string;
  readonly command: ExportCommand;
  readonly fields: readonly ImportFieldKey[];
  readonly actor: ActivityActor;
}

/**
 * "Export products" (D2211): the selected ids (at most 500) or every product the list's filter finds in the active
 * store. Up to {@link EXPORT_SYNC_MAX_ROWS} products the file is written now and answered with a presigned download;
 * above, a `queued` row is handed to the `imports-exports` worker and the dashboard polls it; a filter finding more
 * than {@link EXPORT_MAX_ROWS} is refused before anything is written. The export row and its activity row commit
 * together.
 */
export class ExportProductsService {
  private readonly now: () => Date;

  constructor(private readonly deps: ExportProductsDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Starts the export `command` of the scope's store for `actor`.
   * @throws {@link TooManyRowsError} when the filter finds more than {@link EXPORT_MAX_ROWS} products
   */
  async export(
    ctx: OperationContext,
    scope: StoreScope,
    actor: ActivityActor,
    command: ExportCommand,
  ): Promise<ExportView> {
    const plan = await this.planOf(ctx, scope, command);
    const order: ExportOrder = { id: this.deps.ids.next(), command, fields: command.fields ?? EXPORT_HEADER, actor };
    if (plan.mode === 'job') return this.queue(ctx, scope, { order, filter: plan.filter });
    return this.writeNow(ctx, scope, { order, productIds: plan.productIds });
  }

  /** Selected ids are written now; a filter is counted first (D2211). */
  private async planOf(ctx: OperationContext, scope: StoreScope, command: ExportCommand): Promise<ExportPlan> {
    if (command.scope === 'selected') return { mode: 'now', productIds: command.productIds };
    const filter = exportFilterOf(command.query);
    const first = await firstIdsPage(this.deps.reads, ctx, scope, filter);
    if (first.total > EXPORT_MAX_ROWS) throw new TooManyRowsError();
    if (first.total > EXPORT_SYNC_MAX_ROWS) return { mode: 'job', filter };
    const ids = await filteredIds(this.deps.reads, ctx, scope, { filter, limit: EXPORT_SYNC_MAX_ROWS, first });
    // Products created since the count can push a small filter past the cap: the worker then writes it.
    return ids === undefined ? { mode: 'job', filter } : { mode: 'now', productIds: ids };
  }

  private async writeNow(
    ctx: OperationContext,
    scope: StoreScope,
    run: { readonly order: ExportOrder; readonly productIds: readonly string[] },
  ): Promise<ExportView> {
    const { order } = run;
    const file = await this.deps.files.build(ctx, scope, {
      productIds: run.productIds,
      fields: order.fields,
      format: order.command.format,
    });
    await this.deps.storage.write(exportFileKey(scope, order.id), file.bytes, file.contentType);
    const job = this.newJob(order, {
      status: 'done',
      target: targetOf(order.command),
      rowCount: file.rowCount,
      skippedPacks: file.skippedPacks,
    });
    await this.deps.units.run(ctx, scope, async (tx) => {
      await this.deps.jobs.create(tx, scope, job);
      await this.deps.activity.recordExport(tx, {
        scope,
        exportId: order.id,
        exportScope: order.command.scope,
        format: order.command.format,
        rowCount: file.rowCount,
        skippedPacks: file.skippedPacks,
        actor: order.actor,
      });
    });
    return exportViewOf(this.deps, scope, { ...job, progress: PROGRESS_DONE, errorCode: null });
  }

  /** Stores a `queued` row, then hands it to the worker once it committed; its activity row comes with the file. */
  private async queue(
    ctx: OperationContext,
    scope: StoreScope,
    run: { readonly order: ExportOrder; readonly filter: ExportFilter },
  ): Promise<ExportView> {
    const job = this.newJob(run.order, {
      status: 'queued',
      target: { kind: 'filtered', filter: run.filter },
      rowCount: 0,
      skippedPacks: 0,
    });
    await this.deps.units.run(ctx, scope, (tx) => this.deps.jobs.create(tx, scope, job));
    await this.deps.queue.enqueue({ table: 'export', id: job.id, ...scope });
    return exportViewOf(this.deps, scope, { ...job, progress: 0, errorCode: null });
  }

  private newJob(
    order: ExportOrder,
    state: Pick<NewExportJob, 'status' | 'target' | 'rowCount' | 'skippedPacks'>,
  ): NewExportJob {
    return {
      id: order.id,
      status: state.status,
      format: order.command.format,
      target: state.target,
      fields: order.fields,
      rowCount: state.rowCount,
      skippedPacks: state.skippedPacks,
      actorAdministratorId: order.actor.administratorId,
      at: this.now(),
    };
  }
}

/** The stored target of a command; a filtered export written now keeps its filter. */
function targetOf(command: ExportCommand): ExportTarget {
  return command.scope === 'selected'
    ? { kind: 'selected', productIds: command.productIds }
    : { kind: 'filtered', filter: exportFilterOf(command.query) };
}
