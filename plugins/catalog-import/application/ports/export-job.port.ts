import type { ExportJobStatus, ImportFieldKey, ImportFormat } from '@cod/shared';
import type { ExportTarget } from '../../domain/export-target';
import type { StoreScope } from '../../domain/store-scope';
import type { OperationContext } from './operation-context';

/** A `catalog_export_job` row as the export use cases read it (D2211). */
export interface ExportJobRecord {
  readonly id: string;
  readonly status: ExportJobStatus;
  readonly format: ImportFormat;
  readonly target: ExportTarget;
  readonly fields: readonly ImportFieldKey[];
  readonly rowCount: number;
  /** Percentage of the products read so far. */
  readonly progress: number;
  readonly skippedPacks: number;
  readonly errorCode: string | null;
  readonly actorAdministratorId: number | null;
}

/** A new export row: `done` when the file was written in the request, `queued` for the worker. */
export interface NewExportJob {
  readonly id: string;
  readonly status: 'queued' | 'done';
  readonly format: ImportFormat;
  readonly target: ExportTarget;
  readonly fields: readonly ImportFieldKey[];
  readonly rowCount: number;
  readonly skippedPacks: number;
  readonly actorAdministratorId: number;
  readonly at: Date;
}

/** What a finished export writes on its row. */
export interface ExportResult {
  readonly rowCount: number;
  readonly skippedPacks: number;
  readonly at: Date;
}

/**
 * The export rows of a store through `TenantRepository` (ADR 0002): every call names the scope, matches only the
 * scope's store and joins the transaction `ctx` carries. A done or failed row is never changed again.
 */
export interface ExportJobStore {
  create(ctx: OperationContext, scope: StoreScope, job: NewExportJob): Promise<void>;
  /** The row of the scope's store, or `undefined` (another store's, another business's, or none). */
  byId(ctx: OperationContext, scope: StoreScope, id: string): Promise<ExportJobRecord | undefined>;
  /** `queued` (or a retried `running`) → `running`. */
  markRunning(ctx: OperationContext, scope: StoreScope, id: string, at: Date): Promise<void>;
  setProgress(ctx: OperationContext, scope: StoreScope, id: string, progress: number): Promise<void>;
  /** → `done` with the row count and skipped packs. */
  finish(ctx: OperationContext, scope: StoreScope, id: string, result: ExportResult): Promise<void>;
  /** → `failed` with a fixed code (D2210). */
  fail(ctx: OperationContext, scope: StoreScope, id: string, failure: { errorCode: string; at: Date }): Promise<void>;
}
