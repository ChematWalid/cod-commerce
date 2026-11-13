import { MAX_OPEN_ORDERS_LIMIT } from '@cod/shared';

/** The "Set limit" field read: an empty field clears the limit. */
export type OrderLimitReading =
  { readonly valid: true; readonly maxOpenOrders: number | null } | { readonly valid: false };

const WHOLE_NUMBER = /^\d+$/;

/** A whole number of open orders from 1 to the cap, or nothing for no limit. */
export function orderLimitOf(text: string): OrderLimitReading {
  const trimmed = text.trim();
  if (trimmed === '') return { valid: true, maxOpenOrders: null };
  if (!WHOLE_NUMBER.test(trimmed)) return { valid: false };
  const limit = Number(trimmed);
  return limit >= 1 && limit <= MAX_OPEN_ORDERS_LIMIT ? { valid: true, maxOpenOrders: limit } : { valid: false };
}
