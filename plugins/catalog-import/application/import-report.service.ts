import { IMPORT_LIST_SEPARATOR } from '@cod/shared';
import { IMPORT_REPORT_FORMAT, IMPORT_REPORT_HEADER } from '../domain/constants';
import type { ExportCell } from '../domain/export-row';
import { errorReportKey } from '../domain/object-keys';
import type { PlannedRow } from '../domain/row-plan';
import type { StoreScope } from '../domain/store-scope';
import type { ObjectStorage } from './ports/object-storage.port';
import type { SpreadsheetFormatAdapter } from './ports/spreadsheet-format.port';
import type { SpreadsheetFormatRegistry } from './spreadsheet-format.registry';

/** What a report line is made of: a failed row's number, its reasons and the values that identify it. */
export type ReportRow = Pick<PlannedRow, 'rowNumber' | 'messages' | 'values'>;

/** What {@link ImportReportService} writes through. */
export interface ImportReportDeps {
  readonly storage: Pick<ObjectStorage, 'write'>;
  readonly formats: Pick<SpreadsheetFormatRegistry<SpreadsheetFormatAdapter>, 'get'>;
}

/** One report line: the row number, its reasons (message ids, `;`-separated) and what identifies the row. */
const lineOf = (row: ReportRow): ExportCell[] => [
  row.rowNumber,
  row.messages.join(IMPORT_LIST_SEPARATOR),
  row.values.productKey ?? null,
  row.values.name ?? null,
  row.values.variantSku ?? null,
];

/**
 * The per-row error report of a confirmed import (D2210): a CSV under `exports/…/imports/<id>/errors`, one line per
 * failed row with its number and reasons, written by the registry's CSV writer, so every text cell goes through the
 * formula guard (a `=cmd|` name is written `'=cmd|`). Nothing is written when no row failed.
 */
export class ImportReportService {
  constructor(private readonly deps: ImportReportDeps) {}

  async write(scope: StoreScope, importId: string, rows: readonly ReportRow[]): Promise<void> {
    if (rows.length === 0) return;
    const format = this.deps.formats.get(IMPORT_REPORT_FORMAT);
    const bytes = await format.writer.write(IMPORT_REPORT_HEADER, rows.map(lineOf));
    await this.deps.storage.write(errorReportKey(scope, importId), bytes, format.contentType);
  }
}
