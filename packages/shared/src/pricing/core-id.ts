import { INT_COLUMN_MAX } from '../catalog/constants';
import { PRICING_ID_MAX_LENGTH, PRICING_ID_PATTERN } from './constants';

/**
 * Whether `value` spells a Vendure core id (variant, product, collection): a decimal from 1 to `INT_COLUMN_MAX`
 * without leading zeros. A larger id would reach an `integer` column and fail in Postgres instead of at the boundary.
 */
export function isCoreIdText(value: string): boolean {
  return value.length <= PRICING_ID_MAX_LENGTH && PRICING_ID_PATTERN.test(value) && Number(value) <= INT_COLUMN_MAX;
}
