import { FileTypeError } from '../domain/errors';

/**
 * Spreadsheet formats by key (D2209): each format is one reader and writer adapter, so a new format registers here
 * and no caller switches on the format (§3a.7). Export and import register `xlsx` and `csv`.
 */
export class SpreadsheetFormatRegistry<Adapter> {
  private readonly adapters = new Map<string, Adapter>();

  /**
   * Adds the adapter of `format`.
   * @throws Error when the format already has one
   */
  register(format: string, adapter: Adapter): void {
    if (this.adapters.has(format)) throw new Error(`Spreadsheet format "${format}" is already registered`);
    this.adapters.set(format, adapter);
  }

  /**
   * The adapter of `format`.
   * @throws {@link FileTypeError} for a format nobody registered
   */
  get(format: string): Adapter {
    const adapter = this.adapters.get(format);
    if (adapter === undefined) throw new FileTypeError();
    return adapter;
  }

  /** Every registered format, in registration order. */
  formats(): readonly string[] {
    return [...this.adapters.keys()];
  }
}
