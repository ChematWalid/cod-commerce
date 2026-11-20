import { DOWNLOAD_URL_TTL_SECONDS, type ImportJobStatus } from '@cod/shared';
import type { MappedColumn } from '../domain/column-mapper';
import { IMPORT_ERRORS_DOWNLOAD_BASE, IMPORT_REPORT_FORMAT } from '../domain/constants';
import { errorReportKey } from '../domain/object-keys';
import type { StoreScope } from '../domain/store-scope';
import type { ImportJobRecord, ImportPreviewSummary, ImportResult } from './ports/import-job.port';
import type { StoredImportRow } from './ports/import-row.port';
import type { ObjectStorage } from './ports/object-storage.port';
import type { SpreadsheetFormatAdapter } from './ports/spreadsheet-format.port';
import type { SpreadsheetFormatRegistry } from './spreadsheet-format.registry';

/** One column of the file as the dashboard shows it: its header, the field it fills, and why it is ignored. */
export interface ImportColumnView extends MappedColumn {
  readonly warning: string | null;
}

/**
 * An import as both API surfaces answer it (`CatalogImport`, D2210): its state, the file's columns once analyzed,
 * the preview's counts, what confirm did, and a fresh link to the per-row error report once done with errors.
 */
export interface ImportView {
  readonly importId: string;
  readonly status: ImportJobStatus;
  readonly format: string;
  readonly rowCount: number;
  /** Percentage of the rows applied so far. */
  readonly progress: number;
  readonly headerRow: number | null;
  readonly columns: readonly ImportColumnView[];
  readonly summary: ImportPreviewSummary | null;
  readonly result: ImportResult | null;
  readonly errorCode: string | null;
  readonly errorReportUrl: string | null;
}

/** One preview row as the dashboard lists it: reasons are message ids only, never the cell text. */
export interface ImportPreviewRowView {
  readonly rowNumber: number;
  readonly action: string;
  /** The row's product key; null for a row without one (its own product). */
  readonly productKey: string | null;
  readonly name: string | null;
  readonly messages: readonly string[];
}

/** A page of preview rows (`CatalogImportPreview`), at most 200 (D2210). */
export interface ImportPreviewView {
  readonly importId: string;
  readonly totalItems: number;
  readonly skip: number;
  readonly take: number;
  readonly items: readonly ImportPreviewRowView[];
  readonly summary: ImportPreviewSummary | null;
}

/** What {@link importViewOf} signs the error report link through. */
export interface ImportViewDeps {
  readonly storage: Pick<ObjectStorage, 'presignGet'>;
  readonly formats: Pick<SpreadsheetFormatRegistry<SpreadsheetFormatAdapter>, 'get'>;
}

function columnsOf(job: ImportJobRecord): ImportColumnView[] {
  if (job.mapping === null) return [];
  const warnings = new Map(job.mapping.warnings.map((warning) => [warning.column, warning.reason]));
  return job.mapping.assignments.map((column) => ({ ...column, warning: warnings.get(column.column) ?? null }));
}

/**
 * The answer about an import row of the scope's store (D2208, D2210): a done import with failed rows gets a presigned
 * GET of its error report under `exports/`, valid 5 minutes, named `import-errors-<importId>.csv`. Call it only after
 * the row was read in the caller's own scope.
 */
export async function importViewOf(deps: ImportViewDeps, scope: StoreScope, job: ImportJobRecord): Promise<ImportView> {
  const report = deps.formats.get(IMPORT_REPORT_FORMAT);
  const hasReport = job.status === 'done' && (job.result?.failed ?? 0) > 0;
  const errorReportUrl = hasReport
    ? await deps.storage.presignGet(errorReportKey(scope, job.id), {
        ttlSeconds: DOWNLOAD_URL_TTL_SECONDS,
        downloadName: `${IMPORT_ERRORS_DOWNLOAD_BASE}-${job.id}.${report.extension}`,
        contentType: report.contentType,
      })
    : null;
  return {
    importId: job.id,
    status: job.status,
    format: job.format,
    rowCount: job.rowCount,
    progress: job.progress,
    headerRow: job.headerRow,
    columns: columnsOf(job),
    summary: job.preview,
    result: job.result,
    errorCode: job.errorCode,
    errorReportUrl,
  };
}

/** A stored row as the preview lists it. */
export const previewRowViewOf = (row: StoredImportRow): ImportPreviewRowView => ({
  rowNumber: row.rowNumber,
  action: row.action,
  productKey: row.productKey,
  name: row.values.name ?? null,
  messages: row.messages,
});
