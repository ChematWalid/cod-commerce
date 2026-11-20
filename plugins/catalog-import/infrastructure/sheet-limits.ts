import { IMPORT_MAX_CELL_CHARS, IMPORT_MAX_COLUMNS } from '@cod/shared';
import type { ReadLimits, SheetRow, SheetRows } from '../application/ports/spreadsheet-format.port';
import { IMPORT_MAX_SHEET_CHARS } from '../domain/constants';
import { FileTypeError } from '../domain/errors';

const isBlank = (row: SheetRow): boolean => row.cells.every((cell) => cell.trim() === '');

/**
 * Collects the rows a reader parses and enforces the per-row limits of D2222 as it goes: at most
 * {@link IMPORT_MAX_COLUMNS} columns and {@link IMPORT_MAX_CELL_CHARS} characters per cell, no row after the
 * cooperative deadline, no more than `limits.maxRows` rows (one more marks the file as cut), and no more than
 * {@link IMPORT_MAX_SHEET_CHARS} characters in all (D2269: an xlsx cell naming a shared string costs a few bytes).
 * A blank row (every cell empty once trimmed) is left out and not counted against the row cap (D2271): Excel writes
 * formatted empty rows, so the cap limits data rows, not physical ones; the deadline and the character budget still
 * bound how many blank rows are read.
 */
export class SheetCollector {
  private readonly rows: SheetRow[] = [];
  private truncated = false;
  private characters = 0;

  constructor(private readonly limits: ReadLimits) {}

  /**
   * Adds a row; false once the reader should stop (the cap was passed).
   * @throws {@link FileTypeError} past the deadline, for a row breaking a column or cell limit, or past the
   * character budget
   */
  add(row: SheetRow): boolean {
    if (this.limits.now() > this.limits.deadlineAt) throw new FileTypeError();
    if (row.cells.length > IMPORT_MAX_COLUMNS) throw new FileTypeError();
    if (row.cells.some((cell) => cell.length > IMPORT_MAX_CELL_CHARS)) throw new FileTypeError();
    const blank = isBlank(row);
    if (!blank && this.rows.length >= this.limits.maxRows) {
      this.truncated = true;
      return false;
    }
    this.characters += row.cells.reduce((sum, cell) => sum + cell.length, 0);
    if (this.characters > IMPORT_MAX_SHEET_CHARS) throw new FileTypeError();
    if (!blank) this.rows.push(row);
    return true;
  }

  result(): SheetRows {
    return { rows: this.rows, truncated: this.truncated };
  }
}
