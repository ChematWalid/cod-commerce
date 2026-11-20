import type { ExportCell } from '../../domain/export-row';

/** Writes a spreadsheet file: the header row, then the rows, as the format's bytes (D2209). */
export interface SpreadsheetWriter {
  write(header: readonly string[], rows: readonly (readonly ExportCell[])[]): Promise<Uint8Array>;
}

/** One row of an uploaded file: its number as the merchant sees it (1 = the first line) and its cells as text. */
export interface SheetRow {
  readonly number: number;
  readonly cells: readonly string[];
}

/** The rows a reader read; `truncated` when it stopped at `maxRows` with more to read. */
export interface SheetRows {
  readonly rows: readonly SheetRow[];
  readonly truncated: boolean;
}

/**
 * How far a reader may go (D2222): at most `maxRows` rows, and no row after `deadlineAt` (epoch ms) as read on `now`,
 * the clock that set it.
 */
export interface ReadLimits {
  readonly maxRows: number;
  readonly deadlineAt: number;
  readonly now: () => number;
}

/**
 * Reads an uploaded file of its format (D2209, D2222): only the first worksheet, cached values (never a formula),
 * every parser limit checked before or while parsing.
 */
export interface SpreadsheetReader {
  /**
   * @throws FileTypeError for bytes that are not a readable file of the format, a parser limit broken, or the
   * deadline passed
   */
  read(bytes: Uint8Array, limits: ReadLimits): Promise<SheetRows>;
}

/**
 * One spreadsheet format of the {@link SpreadsheetFormatRegistry}: its file type, its writer (export) and its reader
 * (import), so no caller switches on the format (§3a.7).
 */
export interface SpreadsheetFormatAdapter {
  readonly contentType: string;
  /** The file name extension of a download, without the dot. */
  readonly extension: string;
  readonly writer: SpreadsheetWriter;
  readonly reader: SpreadsheetReader;
}
