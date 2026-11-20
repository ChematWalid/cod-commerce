import { stringify } from 'csv-stringify/sync';
import type { SpreadsheetWriter } from '../application/ports/spreadsheet-format.port';
import { guardCell } from '../domain/cell-guard';
import type { ExportCell } from '../domain/export-row';

const utf8 = new TextEncoder();

/**
 * The CSV writer of the format registry (D2209): UTF-8 with a byte order mark (so Excel on an Arabic or French
 * Windows reads the text right), comma-separated, CRLF lines, every text cell through the formula guard.
 */
export class CsvSpreadsheetWriter implements SpreadsheetWriter {
  write(header: readonly string[], rows: readonly (readonly ExportCell[])[]): Promise<Uint8Array> {
    const records = [header.map(guardCell), ...rows.map((row) => row.map(guardCell))];
    const text = stringify(records, { bom: true, record_delimiter: 'windows' });
    return Promise.resolve(utf8.encode(text));
  }
}
