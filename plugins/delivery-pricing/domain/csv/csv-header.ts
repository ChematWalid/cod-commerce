import { PRICING_CSV_COLUMNS, type PricingCsvColumn, unguardCell } from '@cod/shared';

/** Where each column of a pricing CSV sits in its records. */
export type CsvColumns = Readonly<Record<PricingCsvColumn, number>>;

/** A header or data cell as the import reads it: the export's formula guard dropped, spaces trimmed (D2209). */
export const cellText = (raw: string | undefined): string => unguardCell(raw ?? '').trim();

/**
 * The columns of a header row, matched by name in any letter case; other columns are ignored. `undefined` when a
 * column is missing or named twice, which refuses the whole file.
 */
export function csvColumnsOf(header: readonly string[]): CsvColumns | undefined {
  const names = header.map((cell) => cellText(cell).toLowerCase());
  const entries: [PricingCsvColumn, number][] = [];
  for (const column of PRICING_CSV_COLUMNS) {
    const wanted = column.toLowerCase();
    const index = names.indexOf(wanted);
    if (index === -1 || names.lastIndexOf(wanted) !== index) return undefined;
    entries.push([column, index]);
  }
  return Object.fromEntries(entries) as Record<PricingCsvColumn, number>;
}
