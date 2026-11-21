import { IMPORT_FIELDS, type ImportFieldKey } from '@cod/shared';
import type { SpreadsheetFormatAdapter } from './ports/spreadsheet-format.port';
import type { SpreadsheetFormatRegistry } from './spreadsheet-format.registry';

/** One column of the product spreadsheet as the dashboard lists it; its label is a message id of the dashboard. */
export interface ImportFieldView {
  readonly key: ImportFieldKey;
  readonly required: boolean;
}

/** One spreadsheet format as the dashboard lists it. */
export interface ImportFormatView {
  readonly format: string;
  readonly contentType: string;
  readonly extension: string;
}

/** The columns and formats of import and export (`catalogImportFields`, `catalogImportFormats`, D2206). */
export class ListFieldsService {
  constructor(
    private readonly formatRegistry: Pick<SpreadsheetFormatRegistry<SpreadsheetFormatAdapter>, 'formats' | 'get'>,
  ) {}

  /** The spreadsheet columns in export order (D2209), each with whether a file needs it (D2224). */
  fields(): readonly ImportFieldView[] {
    return IMPORT_FIELDS.map(({ key, required }) => ({ key, required }));
  }

  /** The registered formats in registration order. */
  formats(): readonly ImportFormatView[] {
    return this.formatRegistry.formats().map((format) => {
      const adapter = this.formatRegistry.get(format);
      return { format, contentType: adapter.contentType, extension: adapter.extension };
    });
  }
}
