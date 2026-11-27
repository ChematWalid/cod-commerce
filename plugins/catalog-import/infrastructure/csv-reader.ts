import { detectDelimiter, DomainError, strictUtf8Text } from '@cod/shared';
import { CsvError, parse } from 'csv-parse/sync';
import type { ReadLimits, SheetRows, SpreadsheetReader } from '../application/ports/spreadsheet-format.port';
import { IMPORT_MAX_RECORD_CHARS } from '../domain/constants';
import { FileTypeError } from '../domain/errors';
import { SheetCollector } from './sheet-limits';

/** The text the delimiter is detected on: enough for the header window. */
const DELIMITER_SAMPLE_CHARS = 65_536;

/** Strict UTF-8 text without its byte order mark (shared with delivery pricing, D3142). */
function textOf(bytes: Uint8Array): string {
  const text = strictUtf8Text(bytes);
  // Bytes that are not UTF-8 are not the CSV the import reads.
  if (text === undefined) throw new FileTypeError();
  return text;
}

/** A stop signal from `on_record` once the row cap is passed; csv-parse carries it out of `parse`. */
class EnoughRows extends Error {}

/**
 * The CSV reader of the format registry (D2209, D2222): strict UTF-8 (BOM allowed, as Excel writes it), the
 * delimiter detected among `,`, `;` and tab, csv-parse 7 with `max_record_size` (a single huge line is refused) and
 * unbalanced quotes refused, rows numbered as records (Excel's row numbers), the row and cell limits of
 * {@link SheetCollector} checked per record, reading stopped at `limits.maxRows`.
 */
export class CsvSpreadsheetReader implements SpreadsheetReader {
  read(bytes: Uint8Array, limits: ReadLimits): Promise<SheetRows> {
    return new Promise((resolve) => {
      resolve(this.readNow(bytes, limits));
    });
  }

  private readNow(bytes: Uint8Array, limits: ReadLimits): SheetRows {
    const text = textOf(bytes);
    const collector = new SheetCollector(limits);
    let number = 0;
    try {
      parse(text, {
        delimiter: detectDelimiter(text.slice(0, DELIMITER_SAMPLE_CHARS)),
        relax_column_count: true,
        max_record_size: IMPORT_MAX_RECORD_CHARS,
        on_record: (record: string[]) => {
          number += 1;
          if (!collector.add({ number, cells: record })) throw new EnoughRows();
          return null;
        },
      });
    } catch (error: unknown) {
      if (!(error instanceof EnoughRows || causeOf(error) instanceof EnoughRows)) throw readFailureOf(error);
    }
    return collector.result();
  }
}

const causeOf = (error: unknown): unknown => (error instanceof Error ? error.cause : undefined);

/** Our own refusals pass; csv-parse's (bad quotes, a huge record) are file-type; anything else is a fault. */
function readFailureOf(error: unknown): unknown {
  const cause = causeOf(error);
  if (error instanceof DomainError) return error;
  if (cause instanceof DomainError) return cause;
  if (error instanceof CsvError) return new FileTypeError();
  return error;
}
