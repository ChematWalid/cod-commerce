import type { DeliveryFeeCsvChange, DeliveryFeeCsvValues, PricingCsvRowIssue } from '@cod/shared';
import { CSV_PREVIEW_MAX_ROWS } from '../constants';
import type { CsvImportDto } from '../dto';

/** Translates a catalogue id. */
type Say = (id: string) => string;

const ON_ID = 'delivery-pricing.csv-on';
const OFF_ID = 'delivery-pricing.csv-off';
/** What an empty commune cell, or a commune row with no row, shows: it follows the wilaya. */
const INHERIT_ID = 'delivery-pricing.csv-inherit';
const ARROW = ' → ';

/** The cells of one changed row in the preview table, each `before → after`, or the value once when unchanged. */
export interface CsvChangeCells {
  readonly home: string;
  readonly desk: string;
  readonly delivery: string;
  readonly deskSwitch: string;
}

/** Whether the previewed import can be applied: a preview that changes something and refuses no row (D3142). */
export const canApplyCsv = (result: CsvImportDto | null): boolean =>
  result !== null && result.dryRun && result.totalIssues === 0 && result.changes.length > 0;

/** The catalogue id of a refused row's reason (`delivery-pricing.csv-issue-<issue>`). */
export const csvIssueMessageIdOf = (issue: PricingCsvRowIssue): string => `delivery-pricing.csv-issue-${issue}`;

const priceText = (price: number | null | undefined, say: Say): string =>
  price === null || price === undefined ? say(INHERIT_ID) : String(price);

const switchText = (enabled: boolean | null | undefined, say: Say): string => {
  if (enabled === null || enabled === undefined) return say(INHERIT_ID);
  return say(enabled ? ON_ID : OFF_ID);
};

/** `before → after`, or the text once when the import leaves it as it is. */
const moved = (before: string, after: string): string => (before === after ? after : `${before}${ARROW}${after}`);

/** One changed row as the preview table shows it; a missing side (a new or removed commune row) inherits. */
export function csvCellsOf(change: DeliveryFeeCsvChange, say: Say): CsvChangeCells {
  const cell = (pick: (values: DeliveryFeeCsvValues) => string): string => {
    const inherited = say(INHERIT_ID);
    return moved(
      change.before === null ? inherited : pick(change.before),
      change.after === null ? inherited : pick(change.after),
    );
  };
  return {
    home: cell((values) => priceText(values.homePrice, say)),
    desk: cell((values) => priceText(values.deskPrice, say)),
    delivery: cell((values) => switchText(values.deliveryEnabled, say)),
    deskSwitch: cell((values) => switchText(values.deskEnabled, say)),
  };
}

/** The changed rows the preview table shows (at most `CSV_PREVIEW_MAX_ROWS`) and how many it leaves out. */
export function shownChangesOf(changes: readonly DeliveryFeeCsvChange[]): {
  readonly rows: readonly DeliveryFeeCsvChange[];
  readonly hidden: number;
} {
  const rows = changes.slice(0, CSV_PREVIEW_MAX_ROWS);
  return { rows, hidden: changes.length - rows.length };
}
