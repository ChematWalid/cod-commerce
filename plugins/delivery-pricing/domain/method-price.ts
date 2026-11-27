import { MONEY_MAX_DZD, type QuotePriceSource } from '@cod/shared';
import type { CommuneRateRow, WilayaRateRow } from './fee-group';

/** How the parcel reaches the buyer: to the door or to a carrier's stop desk. */
export type DeliveryMethod = 'home' | 'desk';

/** Whether a stored value is a whole number between 0 and `max`, as the group's input schema accepts it. */
export const isBoundedInt = (value: number, max: number): boolean =>
  Number.isSafeInteger(value) && value >= 0 && value <= max;

/**
 * Whether an amount is a whole DZD between 0 and `MONEY_MAX_DZD`, so the quote can charge it. A stored price is
 * checked too: the price columns have no `CHECK (>= 0)` and a carrier sync writes the bases (D3125), so a negative row
 * must never lower an order, and the storefront must not offer a mode the quote refuses (#294).
 */
export const isQuotablePrice = (value: number): boolean => isBoundedInt(value, MONEY_MAX_DZD);

/** A commune row's price of the method, `override ?? base`; `null` when it sets none, which inherits (D3125). */
function communePriceOf(row: CommuneRateRow | null, method: DeliveryMethod): number | null {
  if (row === null) return null;
  return method === 'home' ? (row.overrideHome ?? row.baseHome) : (row.overrideDesk ?? row.baseDesk);
}

/** The wilaya row's price of the method, `override ?? base` (D3107). */
const wilayaPriceOf = (row: WilayaRateRow, method: DeliveryMethod): number =>
  method === 'home' ? (row.overrideHome ?? row.baseHome) : (row.overrideDesk ?? row.baseDesk);

/** The method's stored price and its layer (D3125): the commune's when it sets one, else the wilaya's. */
export function methodPriceOf(
  wilaya: WilayaRateRow,
  communeRate: CommuneRateRow | null,
  method: DeliveryMethod,
): { readonly price: number; readonly source: QuotePriceSource } {
  const communePrice = communePriceOf(communeRate, method);
  if (communePrice !== null) return { price: communePrice, source: 'commune' };
  return { price: wilayaPriceOf(wilaya, method), source: 'wilaya' };
}
