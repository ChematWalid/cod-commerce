import { detectDelimiter, DomainError, strictUtf8Text } from '@cod/shared';
import { CsvError, parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { PRICING_CSV_MAX_RECORD_CHARS } from '../domain/constants';
import { InvalidPricingCsvFileError, PricingCsvTooManyRowsError } from '../domain/errors';
import type { CsvRecords, PricingCsvPort } from '../domain/ports/pricing-csv.port';

const utf8 = new TextEncoder();
/** csv-stringify quotes the whole CRLF delimiter only; a lone LF or CR would split the record in a line reader. */
const LINE_BREAK = /[\r\n]/;

const causeOf = (error: unknown): unknown => (error instanceof Error ? error.cause : undefined);

/** Our own refusals pass (csv-parse may wrap them); its own (bad quotes, a huge record) are an invalid file. */
function readFailureOf(error: unknown): unknown {
  const cause = causeOf(error);
  if (error instanceof DomainError) return error;
  if (cause instanceof DomainError) return cause;
  if (error instanceof CsvError) return new InvalidPricingCsvFileError();
  return error;
}

/**
 * The pricing CSV adapter (D3142), with catalog-import's behaviour (D2209): strict UTF-8 (BOM allowed, as Excel writes
 * it, read through the shared `strictUtf8Text`), the delimiter detected among `,`, `;` and tab, csv-parse with
 * `max_record_size` and unbalanced quotes refused, reading stopped past the row cap; the export is UTF-8 with a BOM and
 * CRLF lines, a cell holding a line break quoted.
 */
export class CsvPricingFile implements PricingCsvPort {
  read(bytes: Uint8Array, maxRecords: number): CsvRecords {
    const text = strictUtf8Text(bytes);
    if (text === undefined) throw new InvalidPricingCsvFileError();
    const records: string[][] = [];
    try {
      parse(text, {
        delimiter: detectDelimiter(text),
        relax_column_count: true,
        max_record_size: PRICING_CSV_MAX_RECORD_CHARS,
        on_record: (record: string[]) => {
          if (records.length >= maxRecords) throw new PricingCsvTooManyRowsError();
          records.push(record);
          return null;
        },
      });
    } catch (error: unknown) {
      throw readFailureOf(error);
    }
    return records;
  }

  write(records: CsvRecords): Uint8Array {
    const text = stringify(
      records.map((record) => [...record]),
      { bom: true, record_delimiter: 'windows', quoted_match: LINE_BREAK },
    );
    return utf8.encode(text);
  }
}
