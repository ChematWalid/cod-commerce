import type { ExportCell } from '../../domain/export-row';

/** Writes a spreadsheet file: the header row, then the rows, as the format's bytes (D2209). */
export interface SpreadsheetWriter {
  write(header: readonly string[], rows: readonly (readonly ExportCell[])[]): Promise<Uint8Array>;
}

/**
 * One spreadsheet format of the {@link SpreadsheetFormatRegistry}: its file type and its writer (the import's reader
 * joins it in Task 9), so no caller switches on the format (§3a.7).
 */
export interface SpreadsheetFormatAdapter {
  readonly contentType: string;
  /** The file name extension of a download, without the dot. */
  readonly extension: string;
  readonly writer: SpreadsheetWriter;
}
