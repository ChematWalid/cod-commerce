import type { DeliveryFeeCsvValues, PricingCsvColumn, PricingCsvRowIssue, WilayaCode } from '@cod/shared';
import { type CellReading, readCommune, readLevel, readPrice, readProvince, readSwitch } from './csv-cells';
import { cellText, type CsvColumns } from './csv-header';

/** What a data row is checked against: the wilayas the group holds rows of, and each commune's wilaya in geo. */
export interface CsvRowContext {
  readonly heldProvinces: ReadonlySet<WilayaCode>;
  readonly provinceOfTown: ReadonlyMap<number, WilayaCode>;
}

/** A wilaya row: every price and switch given. */
export interface CsvWilayaRow {
  readonly level: 'wilaya';
  readonly provinceCode: WilayaCode;
  readonly values: { readonly [K in keyof DeliveryFeeCsvValues]: NonNullable<DeliveryFeeCsvValues[K]> };
}

/** A commune row of its wilaya: an empty price or switch (`null`) inherits. */
export interface CsvCommuneRow {
  readonly level: 'commune';
  readonly provinceCode: WilayaCode;
  readonly codeOns: number;
  readonly values: DeliveryFeeCsvValues;
}

/** A data row as read, or the column to blame and why it is refused. */
export type CsvRowReading =
  | { readonly ok: true; readonly row: CsvWilayaRow | CsvCommuneRow }
  | { readonly ok: false; readonly column: PricingCsvColumn; readonly issue: PricingCsvRowIssue };

/** Thrown inside a row read to refuse the row; caught by {@link readCsvRow}, never outside. */
class RowRefused extends Error {
  constructor(
    readonly column: PricingCsvColumn,
    readonly issue: PricingCsvRowIssue,
  ) {
    super(`Pricing CSV row refused: ${issue}`);
    this.name = 'RowRefused';
  }
}

/** The cells of one record, read through the header's columns. */
class RecordCells {
  constructor(
    private readonly record: readonly string[],
    private readonly columns: CsvColumns,
  ) {}

  text(column: PricingCsvColumn): string {
    return cellText(this.record[this.columns[column]]);
  }

  /** The column's value, or the row refused with the column named. */
  take<T>(column: PricingCsvColumn, reading: (text: string) => CellReading<T>): T {
    const read = reading(this.text(column));
    if (!read.ok) throw new RowRefused(column, read.issue);
    return read.value;
  }
}

/** The prices and switches of a row; a wilaya row needs each one, a commune row leaves an empty one to inherit. */
function valuesOf(cells: RecordCells, required: boolean): DeliveryFeeCsvValues {
  return {
    homePrice: cells.take('homePrice', (text) => readPrice(text, required)),
    deskPrice: cells.take('deskPrice', (text) => readPrice(text, required)),
    deliveryEnabled: cells.take('deliveryEnabled', (text) => readSwitch(text, required)),
    deskEnabled: cells.take('deskEnabled', (text) => readSwitch(text, required)),
  };
}

function rowOf(cells: RecordCells, context: CsvRowContext): CsvWilayaRow | CsvCommuneRow {
  const level = cells.take('level', readLevel);
  const provinceCode = cells.take('provinceCode', (text) => readProvince(text, context.heldProvinces));
  if (level === 'wilaya') {
    if (cells.text('codeOns') !== '') throw new RowRefused('codeOns', 'unexpected-commune');
    return { level, provinceCode, values: valuesOf(cells, true) as CsvWilayaRow['values'] };
  }
  const codeOns = cells.take('codeOns', (text) => readCommune(text, provinceCode, context.provinceOfTown));
  return { level, provinceCode, codeOns, values: valuesOf(cells, false) };
}

/** One data record of a pricing CSV, its cells unguarded and trimmed; the first refused cell names the issue. */
export function readCsvRow(record: readonly string[], columns: CsvColumns, context: CsvRowContext): CsvRowReading {
  try {
    return { ok: true, row: rowOf(new RecordCells(record, columns), context) };
  } catch (refused: unknown) {
    if (refused instanceof RowRefused) return { ok: false, column: refused.column, issue: refused.issue };
    throw refused;
  }
}
