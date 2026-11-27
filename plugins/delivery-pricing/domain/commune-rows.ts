import type { CommuneRateRow } from './fee-group';

/** The stored fields of a commune row besides its keys. */
const COMMUNE_FIELDS = [
  'baseHome',
  'baseDesk',
  'overrideHome',
  'overrideDesk',
  'deliveryEnabled',
  'deskEnabled',
] as const satisfies readonly (keyof CommuneRateRow)[];

/** Whether `right` is stored and holds the same prices and switches as `left`. */
export const sameCommuneRow = (left: CommuneRateRow, right: CommuneRateRow | undefined): boolean =>
  right !== undefined && COMMUNE_FIELDS.every((field) => left[field] === right[field]);

/** Whether a commune row holds nothing: every price and switch inherits, so the row goes. */
export const isEmptyCommuneRow = (row: CommuneRateRow): boolean => COMMUNE_FIELDS.every((field) => row[field] === null);
