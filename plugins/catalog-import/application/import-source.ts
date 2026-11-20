import { createHash } from 'node:crypto';
import {
  IMPORT_HEADER_WINDOW_ROWS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_PARSE_DEADLINE_MS,
  type ImportFieldKey,
  isSnowflake,
} from '@cod/shared';
import type { ColumnMap } from '../domain/column-mapper';
import { FileTypeError, JobNotFoundError } from '../domain/errors';
import { sniffSpreadsheet } from '../domain/file-sniff';
import type { RawImportRow } from '../domain/import-row';
import { importSourceKey } from '../domain/object-keys';
import type { StoreScope } from '../domain/store-scope';
import type { ImportJobRecord, ImportJobStore } from './ports/import-job.port';
import type { ObjectStorage } from './ports/object-storage.port';
import type { OperationContext } from './ports/operation-context';
import type { SheetRow, SheetRows, SpreadsheetFormatAdapter } from './ports/spreadsheet-format.port';
import type { SpreadsheetFormatRegistry } from './spreadsheet-format.registry';

/** Rows a reader reads at most: the header window, then the row cap; one more marks the file too long (D2222). */
export const IMPORT_READ_ROWS = IMPORT_HEADER_WINDOW_ROWS + IMPORT_MAX_ROWS;

/** What the import steps read the uploaded file through. */
export interface ImportSourceDeps {
  readonly storage: Pick<ObjectStorage, 'read'>;
  readonly formats: Pick<SpreadsheetFormatRegistry<SpreadsheetFormatAdapter>, 'get'>;
  readonly clock?: () => number;
}

/**
 * The spreadsheet import `id` of the scope's store.
 * @throws {@link JobNotFoundError} for another store's, another business's, a link import's, a missing or a malformed
 * id: one answer (D2136)
 */
export async function importOf(
  jobs: Pick<ImportJobStore, 'byId'>,
  ctx: OperationContext,
  scope: StoreScope,
  id: string,
): Promise<ImportJobRecord> {
  if (!isSnowflake(id)) throw new JobNotFoundError();
  const job = await jobs.byId(ctx, scope, id);
  if (job === undefined) throw new JobNotFoundError();
  return job;
}

/**
 * The rows of the uploaded file of `job`, read only if its object still has `etag` (D2208); its first bytes must
 * sniff as the job's format, then the format's reader reads it within the row cap and the parse deadline (D2222).
 * @throws JobStateError when the object changed or is gone; FileTypeError for another format or when the reader
 * refuses the bytes
 */
export async function readSource(
  deps: ImportSourceDeps,
  scope: StoreScope,
  source: { readonly job: ImportJobRecord; readonly etag: string },
): Promise<SheetRows> {
  const { job, etag } = source;
  const bytes = await deps.storage.read(importSourceKey(scope, job.id), { maxBytes: IMPORT_MAX_BYTES, ifMatch: etag });
  if (sniffSpreadsheet(bytes) !== job.format) throw new FileTypeError();
  const clock = deps.clock ?? Date.now;
  const reader = deps.formats.get(job.format).reader;
  return reader.read(bytes, { maxRows: IMPORT_READ_ROWS, deadlineAt: clock() + IMPORT_PARSE_DEADLINE_MS });
}

const isBlank = (row: SheetRow): boolean => row.cells.every((cell) => cell.trim() === '');

/** The data rows after the header line `headerRow` (0-based), blank rows left out. */
export function dataRowsOf(rows: readonly SheetRow[], headerRow: number): SheetRow[] {
  return rows.filter((row) => row.number > headerRow + 1 && !isBlank(row));
}

/** The header line's cells. */
export function headerCellsOf(rows: readonly SheetRow[], headerRow: number): readonly string[] {
  return rows.find((row) => row.number === headerRow + 1)?.cells ?? [];
}

/** A data row's mapped cells by field. */
export function rawRowOf(row: SheetRow, map: ColumnMap): RawImportRow {
  const cells: Partial<Record<ImportFieldKey, string>> = {};
  for (const { column, field } of map.assignments) {
    if (field !== null) cells[field] = row.cells[column] ?? '';
  }
  return { rowNumber: row.number, cells };
}

/** The hash a preview's rows are stored with: the mapping they were computed from (D2210). */
export function mappingHashOf(map: ColumnMap): string {
  const assignments = map.assignments.map(({ column, field }) => [column, field]);
  return createHash('sha256').update(JSON.stringify(assignments)).digest('hex');
}
