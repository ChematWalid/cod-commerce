/** The records of a CSV, each a list of its cells as text. */
export type CsvRecords = readonly (readonly string[])[];

/** Reads and writes the bytes of a pricing-option CSV (D3142); the format behaviour is catalog-import's (D2209). */
export interface PricingCsvPort {
  /**
   * The records of strict UTF-8 CSV `bytes` (a byte order mark is dropped, the delimiter is `,`, `;` or tab), every
   * record answered, blank ones included.
   *
   * @throws {InvalidPricingCsvFileError} for bytes that are not UTF-8, or text that is not CSV.
   * @throws {PricingCsvTooManyRowsError} as soon as a non-blank record past `maxRecords` is read: blank records
   *   (every cell empty once unguarded and trimmed) do not count.
   */
  read(bytes: Uint8Array, maxRecords: number): CsvRecords;
  /** UTF-8 CSV with a byte order mark and CRLF lines, as Excel opens it; the cells are written as given. */
  write(records: CsvRecords): Uint8Array;
}
