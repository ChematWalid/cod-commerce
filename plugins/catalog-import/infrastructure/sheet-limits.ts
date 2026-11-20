import { IMPORT_MAX_CELL_CHARS, IMPORT_MAX_COLUMNS } from '@cod/shared';
import type { ReadLimits, SheetRow, SheetRows } from '../application/ports/spreadsheet-format.port';
import { FileTypeError } from '../domain/errors';

/**
 * Collects the rows a reader parses and enforces the per-row limits of D2222 as it goes: at most
 * {@link IMPORT_MAX_COLUMNS} columns and {@link IMPORT_MAX_CELL_CHARS} characters per cell, no row after the
 * cooperative deadline, and no more than `limits.maxRows` rows (one more marks the file as cut).
 */
export class SheetCollector {
  private readonly rows: SheetRow[] = [];
  private truncated = false;

  constructor(private readonly limits: ReadLimits) {}

  /**
   * Adds a row; false once the reader should stop (the cap was passed).
   * @throws {@link FileTypeError} past the deadline, or for a row breaking a column or cell limit
   */
  add(row: SheetRow): boolean {
    if (this.limits.now() > this.limits.deadlineAt) throw new FileTypeError();
    if (row.cells.length > IMPORT_MAX_COLUMNS) throw new FileTypeError();
    if (row.cells.some((cell) => cell.length > IMPORT_MAX_CELL_CHARS)) throw new FileTypeError();
    if (this.rows.length >= this.limits.maxRows) {
      this.truncated = true;
      return false;
    }
    this.rows.push(row);
    return true;
  }

  result(): SheetRows {
    return { rows: this.rows, truncated: this.truncated };
  }
}
