import type { PlannedRow } from '../../domain/row-plan';
import type { StoreScope } from '../../domain/store-scope';
import type { ImportResult } from './import-job.port';
import type { OperationContext } from './operation-context';

/** A stored preview row: its plan, and whether confirm has dealt with it yet (D2210). */
export interface StoredImportRow extends PlannedRow {
  readonly applied: boolean;
}

/** A page of an import's preview rows, in row order, and how many it holds in all. */
export interface ImportRowPage {
  readonly rows: readonly StoredImportRow[];
  readonly total: number;
}

/**
 * Rows confirm dealt with: applied to `productId`, or refused with `failure` (a stable code; the row becomes an error
 * with that reason). Marked in the transaction of the product write, so a rerun skips them (D2210).
 */
export interface AppliedRows {
  readonly jobId: string;
  readonly rowNumbers: readonly number[];
  readonly productId: string | null;
  readonly failure?: string;
}

/** The `catalog_import_row` rows of a store's imports through `TenantRepository` (ADR 0002). */
export interface ImportRowStore {
  /** Replaces the job's preview rows with `rows`. */
  replace(ctx: OperationContext, scope: StoreScope, jobId: string, rows: readonly PlannedRow[]): Promise<void>;
  page(
    ctx: OperationContext,
    scope: StoreScope,
    jobId: string,
    page: { readonly skip: number; readonly take: number },
  ): Promise<ImportRowPage>;
  /** Whether any stored row is an update (confirm then needs `catalog.products.edit`, D2207). */
  hasUpdates(ctx: OperationContext, scope: StoreScope, jobId: string): Promise<boolean>;
  /** The create and update rows not applied yet, in row order. */
  pending(ctx: OperationContext, scope: StoreScope, jobId: string): Promise<readonly StoredImportRow[]>;
  /** The error rows, in row order: the error report's lines. */
  failed(ctx: OperationContext, scope: StoreScope, jobId: string): Promise<readonly StoredImportRow[]>;
  markApplied(ctx: OperationContext, scope: StoreScope, applied: AppliedRows): Promise<void>;
  /** What the applied rows did. */
  resultOf(ctx: OperationContext, scope: StoreScope, jobId: string): Promise<ImportResult>;
}
