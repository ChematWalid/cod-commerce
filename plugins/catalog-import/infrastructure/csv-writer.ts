import { stringify } from 'csv-stringify/sync';
import type { SpreadsheetWriter } from '../application/ports/spreadsheet-format.port';
import { guardCell } from '@cod/shared';
import type { ExportCell } from '../domain/export-row';

const utf8 = new TextEncoder();
/** csv-stringify quotes the whole CRLF delimiter only; a lone LF or CR would split the record in a line reader. */
const LINE_BREAK = /[\r\n]/;

/**
 * The CSV writer of the format registry (D2209): UTF-8 with a byte order mark (so Excel on an Arabic or French
 * Windows reads the text right), comma-separated, CRLF lines, a cell holding any line break quoted, every text cell through the formula guard.
 */
export class CsvSpreadsheetWriter implements SpreadsheetWriter {
  write(header: readonly string[], rows: readonly (readonly ExportCell[])[]): Promise<Uint8Array> {
    const records = [header.map(guardCell), ...rows.map((row) => row.map(guardCell))];
    const text = stringify(records, { bom: true, record_delimiter: 'windows', quoted_match: LINE_BREAK });
    return Promise.resolve(utf8.encode(text));
  }
}
