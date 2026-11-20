import type { ImportFormat, ImportJobStatus } from '@cod/shared';
import type { ColumnMap } from '../../domain/column-mapper';
import type { StoreScope } from '../../domain/store-scope';
import type { OperationContext } from './operation-context';

/** What a preview found, by row: creates, updates, errors, and rows applied with a warning (D2210). */
export interface ImportPreviewSummary {
  readonly creates: number;
  readonly updates: number;
  readonly errors: number;
  readonly warnings: number;
}

/** What a confirmed import did, by row: created, updated, and refused (preview errors and refusals at apply). */
export interface ImportResult {
  readonly created: number;
  readonly updated: number;
  readonly failed: number;
}

/** A spreadsheet `catalog_import_job` row as the import use cases read it (D2210). */
export interface ImportJobRecord {
  readonly id: string;
  readonly status: ImportJobStatus;
  readonly format: ImportFormat;
  readonly declaredSize: number;
  readonly declaredContentType: string;
  /** The object's ETag analyze saw; every later read is pinned to it (D2208). */
  readonly etag: string | null;
  /** The header row, 0-based line index in the file. */
  readonly headerRow: number | null;
  readonly mapping: ColumnMap | null;
  /** Data rows of the file. */
  readonly rowCount: number;
  /** Percentage of the rows applied so far. */
  readonly progress: number;
  readonly preview: ImportPreviewSummary | null;
  readonly result: ImportResult | null;
  readonly errorCode: string | null;
  /** The creating administrator, replaced by the confirming one at confirm (D2207). */
  readonly actorAdministratorId: number | null;
}

/** A new import job, `awaiting_upload` its declared file (D2208). */
export interface NewImportJob {
  readonly id: string;
  readonly format: ImportFormat;
  readonly declaredSize: number;
  readonly declaredContentType: string;
  readonly actorAdministratorId: number;
  readonly at: Date;
}

/** What analyze stores: the pinned ETag, the header row, the detected mapping and the data row count. */
export interface AnalyzedImport {
  readonly etag: string;
  readonly headerRow: number;
  readonly mapping: ColumnMap;
  readonly mappingHash: string;
  readonly rowCount: number;
  readonly at: Date;
}

/** What a preview stores on the job beside its rows. */
export interface PreviewedImport {
  readonly mapping: ColumnMap;
  readonly mappingHash: string;
  readonly preview: ImportPreviewSummary;
  readonly at: Date;
}

/** Who confirms, and when. */
export interface ConfirmingActor {
  readonly actorAdministratorId: number;
  readonly at: Date;
}

/**
 * The spreadsheet import rows of a store through `TenantRepository` (ADR 0002): every call names the scope, matches
 * only the scope's store and the `spreadsheet` kind, and joins the transaction `ctx` carries. A done or failed row is
 * never changed again.
 */
export interface ImportJobStore {
  create(ctx: OperationContext, scope: StoreScope, job: NewImportJob): Promise<void>;
  /** The spreadsheet import of the scope's store, or `undefined` (another store's or business's, a link import, none). */
  byId(ctx: OperationContext, scope: StoreScope, id: string): Promise<ImportJobRecord | undefined>;
  /** `awaiting_upload`/`analyzed` → `analyzed`. */
  markAnalyzed(ctx: OperationContext, scope: StoreScope, id: string, analyzed: AnalyzedImport): Promise<void>;
  /** `analyzed`/`previewed` → `previewed`. */
  markPreviewed(ctx: OperationContext, scope: StoreScope, id: string, previewed: PreviewedImport): Promise<void>;
  /** Atomically `previewed` → `confirming` with the confirming actor; false when the row was not `previewed`. */
  beginConfirm(ctx: OperationContext, scope: StoreScope, id: string, by: ConfirmingActor): Promise<boolean>;
  /** `confirming` (or a retried `running`) → `running`. */
  markRunning(ctx: OperationContext, scope: StoreScope, id: string, at: Date): Promise<void>;
  setProgress(ctx: OperationContext, scope: StoreScope, id: string, progress: number): Promise<void>;
  /** → `done` with what the import did. */
  finish(ctx: OperationContext, scope: StoreScope, id: string, done: { result: ImportResult; at: Date }): Promise<void>;
}
