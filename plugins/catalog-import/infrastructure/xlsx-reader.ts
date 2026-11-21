import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import type { ReadLimits, SheetRow, SheetRows, SpreadsheetReader } from '../application/ports/spreadsheet-format.port';
import { FileTypeError } from '../domain/errors';
import { inspectZip } from '../domain/zip-inspect';
import { localHeadersMatch } from '../domain/zip-local-headers';
import { SheetCollector } from './sheet-limits';
import { assertSafeParts } from './xml-guard';

/** What exceljs puts in a cell: a scalar, or an object for formulas, rich text, links and errors. */
type CellValue = ExcelJS.CellValue;

/** The text of a cell as Excel showed it: the cached result of a formula, never the formula (D2222). */
function textOf(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  return textOfObject(value);
}

function textOfObject(value: object): string {
  if ('result' in value) return textOf(value.result as CellValue);
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((run: { text?: unknown }) => (typeof run.text === 'string' ? run.text : '')).join('');
  }
  if ('text' in value) return textOf(value.text as CellValue);
  // An error cell (#N/A, #REF!) or a formula without a cached result shows no value.
  return '';
}

/** A row's cells as text: exceljs's `values` are 1-based and sparse. */
function cellsOf(row: ExcelJS.Row): string[] {
  const values = row.values as CellValue[];
  return Array.from({ length: Math.max(0, values.length - 1) }, (_, index) => textOf(values[index + 1]));
}

/** Reads the first worksheet's rows into `collector`, stopping at its cap whatever the sheet's declared dimension. */
async function readFirstSheet(workbook: ExcelJS.stream.xlsx.WorkbookReader, collector: SheetCollector): Promise<void> {
  for await (const sheet of workbook) {
    for await (const row of sheet) {
      const sheetRow: SheetRow = { number: row.number, cells: cellsOf(row) };
      if (!collector.add(sheetRow)) return;
    }
    // Only the first worksheet is read (D2222).
    return;
  }
}

/** Whether exceljs failed on the bytes (a broken zip or XML), as opposed to one of our own refusals. */
const isParseFailure = (error: unknown): boolean => error instanceof Error && !(error instanceof FileTypeError);

/**
 * The xlsx reader of the format registry (D2209, D2222, D2266): the zip's central directory checked first
 * (`inspectZip`: entries, sizes, ratio, workbook parts), then its local records matched to it one to one
 * (`localHeadersMatch`: exceljs reads the local records, not the directory), every part inflated within its claimed
 * size and XML parts with a DTD or entity refused (`assertSafeParts`), then exceljs's
 * streaming `WorkbookReader` reads the first worksheet's cached values, with the row, column, cell and deadline limits
 * of {@link SheetCollector}.
 */
export class XlsxSpreadsheetReader implements SpreadsheetReader {
  async read(bytes: Uint8Array, limits: ReadLimits): Promise<SheetRows> {
    const verdict = inspectZip(bytes);
    if (!verdict.ok || !localHeadersMatch(bytes, verdict.entries, verdict.directoryOffset)) {
      throw new FileTypeError();
    }
    assertSafeParts(bytes, verdict.entries);
    const collector = new SheetCollector(limits);
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from([Buffer.from(bytes)]), {
      worksheets: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
      entries: 'ignore',
    });
    try {
      await readFirstSheet(workbook, collector);
    } catch (error: unknown) {
      if (isParseFailure(error)) throw new FileTypeError();
      throw error;
    }
    return collector.result();
  }
}
