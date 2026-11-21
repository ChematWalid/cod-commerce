import type { StoreScope } from '../domain/store-scope';
import { importOf } from './import-source';
import { type ImportView, importViewOf, type ImportViewDeps } from './import-view';
import type { ImportJobStore } from './ports/import-job.port';
import type { OperationContext } from './ports/operation-context';

/** What {@link ImportStatusService} reads through. */
export interface ImportStatusDeps extends ImportViewDeps {
  readonly jobs: Pick<ImportJobStore, 'byId'>;
}

/**
 * "Where is my import" (`catalogImport`, D2210): the spreadsheet import of the caller's own store, with a fresh link
 * to its error report once done. Jobs are read only by their business and store (D2207); anything else is not found.
 */
export class ImportStatusService {
  constructor(private readonly deps: ImportStatusDeps) {}

  async status(ctx: OperationContext, scope: StoreScope, id: string): Promise<ImportView> {
    return importViewOf(this.deps, scope, await importOf(this.deps.jobs, ctx, scope, id));
  }
}
