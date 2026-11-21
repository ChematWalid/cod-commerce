import { isSnowflake } from '@cod/shared';
import { JobNotFoundError } from '../domain/errors';
import type { StoreScope } from '../domain/store-scope';
import { type ExportView, exportViewOf, type ExportViewDeps } from './export-view';
import type { ExportJobStore } from './ports/export-job.port';
import type { OperationContext } from './ports/operation-context';

/** What {@link ExportStatusService} reads through. */
export interface ExportStatusDeps extends ExportViewDeps {
  readonly jobs: Pick<ExportJobStore, 'byId'>;
}

/**
 * "Where is my export" (`catalogExport`, D2211): the row of the caller's own store, with a fresh download link once it
 * is done. Jobs are read only by their business and store (D2207).
 */
export class ExportStatusService {
  constructor(private readonly deps: ExportStatusDeps) {}

  /**
   * The export `id` of the scope's store.
   * @throws {@link JobNotFoundError} for another store's, another business's, a missing or a malformed id (D2136)
   */
  async status(ctx: OperationContext, scope: StoreScope, id: string): Promise<ExportView> {
    if (!isSnowflake(id)) throw new JobNotFoundError();
    const job = await this.deps.jobs.byId(ctx, scope, id);
    if (job === undefined) throw new JobNotFoundError();
    return exportViewOf(this.deps, scope, job);
  }
}
