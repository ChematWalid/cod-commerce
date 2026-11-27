import { PassThrough } from 'node:stream';
import ExcelJS from 'exceljs';
import type { SpreadsheetWriter } from '../application/ports/spreadsheet-format.port';
import { guardCell } from '@cod/shared';
import type { ExportCell } from '../domain/export-row';
import { collectBytes } from './object-bytes';

/** The one worksheet of an export; the import reads only the first one (D2222). */
const SHEET_NAME = 'products';

/**
 * The xlsx writer of the format registry (D2209): exceljs's streaming `WorkbookWriter` (tech-stack.md), no shared
 * strings or styles, numbers as number cells and text as text cells through the formula guard, never a formula.
 */
export class XlsxSpreadsheetWriter implements SpreadsheetWriter {
  async write(header: readonly string[], rows: readonly (readonly ExportCell[])[]): Promise<Uint8Array> {
    const stream = new PassThrough();
    const bytes = collectBytes(stream);
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: false, useSharedStrings: false });
    const sheet = workbook.addWorksheet(SHEET_NAME);
    sheet.addRow(header.map(guardCell)).commit();
    for (const row of rows) sheet.addRow(row.map(guardCell)).commit();
    sheet.commit();
    await workbook.commit();
    return bytes;
  }
}
