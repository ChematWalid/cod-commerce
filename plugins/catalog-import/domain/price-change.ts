import { type BulkPriceChange, MONEY_MAX_DZD } from '@cod/shared';

/**
 * Decimals a percentage product is rounded to before the half-up step: enough for any percent a client sends, and
 * it absorbs binary noise (10.1 % of 1 000 is 1 101, not 1 100.999…).
 */
const PERCENT_PRODUCT_DECIMALS = 6;
const PERCENT_BASE = 100;
/** Added before flooring, so a half rounds up. */
const HALF = 0.5;

/** Half-up to whole DZD; every result it rounds is at least 0 (percent ≥ −100). */
const halfUp = (value: number): number => Math.floor(Number(value.toFixed(PERCENT_PRODUCT_DECIMALS)) + HALF);

/** The unrounded or exact price a change gives. */
function changedPrice(price: number, change: BulkPriceChange): number {
  if (change.mode === 'fixed') return change.value;
  if (change.mode === 'amount') return price + change.value;
  return halfUp((price * (PERCENT_BASE + change.value)) / PERCENT_BASE);
}

/**
 * The whole-DZD price `change` makes of `price` (D2213): a percentage rounded half-up, a signed amount added, or a
 * fixed price. `undefined` when the result is below 0 or above the money maximum: that product's error.
 */
export function applyPriceChange(price: number, change: BulkPriceChange): number | undefined {
  const result = changedPrice(price, change);
  return result < 0 || result > MONEY_MAX_DZD ? undefined : result;
}
