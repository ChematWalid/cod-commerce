import { IMPORT_CONTENT_TYPE_OF_FORMAT } from '@cod/shared';
import type { SpreadsheetFormatAdapter } from '../application/ports/spreadsheet-format.port';
import { SpreadsheetFormatRegistry } from '../application/spreadsheet-format.registry';
import { CsvSpreadsheetWriter } from './csv-writer';
import { XlsxSpreadsheetWriter } from './xlsx-writer';

/** The registry with the two formats of D2209; a new format is one more `register` line (§3a.7). */
export function spreadsheetFormats(): SpreadsheetFormatRegistry<SpreadsheetFormatAdapter> {
  const registry = new SpreadsheetFormatRegistry<SpreadsheetFormatAdapter>();
  registry.register('xlsx', {
    contentType: IMPORT_CONTENT_TYPE_OF_FORMAT.xlsx,
    extension: 'xlsx',
    writer: new XlsxSpreadsheetWriter(),
  });
  registry.register('csv', {
    contentType: IMPORT_CONTENT_TYPE_OF_FORMAT.csv,
    extension: 'csv',
    writer: new CsvSpreadsheetWriter(),
  });
  return registry;
}
