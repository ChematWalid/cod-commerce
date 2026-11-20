import { ConfirmNeedsEditError, JobStateError } from '../domain/errors';
import { importSourceKey } from '../domain/object-keys';
import type { StoreScope } from '../domain/store-scope';
import type { ExportQueuePort } from './ports/export-queue.port';
import { importOf } from './import-source';
import { type ImportView, importViewOf, type ImportViewDeps } from './import-view';
import type { ImportJobStore } from './ports/import-job.port';
import type { ImportRowStore } from './ports/import-row.port';
import type { ObjectStorage } from './ports/object-storage.port';
import type { OperationContext } from './ports/operation-context';
import type { UnitOfWorkPort } from './ports/unit-of-work.port';

/** Who confirms (D2207): the administrator, and whether they hold `catalog.products.edit` on the active store. */
export interface ImportActor {
  readonly administratorId: number;
  readonly canEdit: boolean;
}

/** What {@link ConfirmImportService} runs through. */
export interface ConfirmImportDeps extends ImportViewDeps {
  readonly jobs: Pick<ImportJobStore, 'byId' | 'beginConfirm'>;
  readonly rows: Pick<ImportRowStore, 'hasUpdates'>;
  readonly storage: Pick<ObjectStorage, 'head' | 'presignGet'>;
  readonly queue: ExportQueuePort;
  readonly units: UnitOfWorkPort;
  readonly now?: () => Date;
}

/**
 * "Confirm an import" (D2207, D2210, Review Focus 4): an actor without `catalog.products.edit` cannot confirm a preview
 * holding update rows (whoever previewed it); a file re-put since the preview (its ETag changed, or gone) is
 * `job-state`; the row moves atomically `previewed → confirming` with the confirming actor (a second confirm finds it
 * moved: `job-state`), then is handed to the `imports-exports` worker, which applies exactly the stored rows. The
 * update check runs after the move, in its transaction: the move locks the job row, so the rows checked are the rows
 * the worker applies, and no preview can store others after it (D2265).
 */
export class ConfirmImportService {
  private readonly now: () => Date;

  constructor(private readonly deps: ConfirmImportDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async confirm(ctx: OperationContext, scope: StoreScope, actor: ImportActor, importId: string): Promise<ImportView> {
    const job = await importOf(this.deps.jobs, ctx, scope, importId);
    if (job.status !== 'previewed' || job.etag === null) throw new JobStateError();
    const head = await this.deps.storage.head(importSourceKey(scope, job.id));
    if (head?.etag !== job.etag) throw new JobStateError();
    await this.deps.units.run(ctx, scope, async (tx) => {
      const by = { actorAdministratorId: actor.administratorId, at: this.now() };
      if (!(await this.deps.jobs.beginConfirm(tx, scope, job.id, by))) throw new JobStateError();
      if (!actor.canEdit && (await this.deps.rows.hasUpdates(tx, scope, job.id))) throw new ConfirmNeedsEditError();
    });
    await this.deps.queue.enqueue({ table: 'import', id: job.id, ...scope });
    return importViewOf(this.deps, scope, {
      ...job,
      status: 'confirming',
      actorAdministratorId: actor.administratorId,
    });
  }
}
