import { INT_COLUMN_MAX } from '@cod/shared';

const PRODUCT_ID_FORMAT = /^[1-9][0-9]{0,9}$/;

/**
 * The id of a Vendure product or variant (a positive Postgres `integer`, no leading zero), or `undefined` for a
 * malformed one, which every call answers as "not found" (D2136). Never reaches the database malformed.
 */
export function parseProductId(value: string): string | undefined {
  return PRODUCT_ID_FORMAT.test(value) && Number(value) <= INT_COLUMN_MAX ? value : undefined;
}
