import { DELIVERY_SPEEDS, MONEY_MAX_DZD, type QuotePriceSource, type ShippingQuote } from '@cod/shared';
import { GRAMS_PER_KG } from './constants';
import type { CommuneRateRow, FeeGroupSettings, WilayaRateRow } from './fee-group';
import { modesOf } from './store-modes';

/** How the parcel reaches the buyer: to the door or to a carrier's stop desk. */
export type DeliveryMethod = 'home' | 'desk';

/** What the quote reads of a named commune in the geo reference data: whether a carrier desk is there. */
export interface QuoteTown {
  readonly isStopdesk: boolean;
}

/** The group's overweight settings: the only ones there are, no wilaya or commune has its own (D3125). */
export type OverweightSettings = Pick<
  FeeGroupSettings,
  'chargeOverweight' | 'overweightAllowanceKg' | 'overweightRate'
>;

/**
 * Everything one delivery quote reads, loaded beforehand so the rule stays pure: the group's overweight settings, the
 * wilaya row (`null` when the group has none), the commune row (`null` when absent or no commune is named), the named
 * commune's reference (`null` when no commune is named), the parcel weight and the method.
 */
export interface DeliveryQuoteInput {
  readonly group: OverweightSettings;
  readonly rate: WilayaRateRow | null;
  readonly communeRate: CommuneRateRow | null;
  readonly town: QuoteTown | null;
  readonly weightGrams: number;
  readonly method: DeliveryMethod;
  readonly waive: boolean;
}

/** The one unresolved quote (D3113): not offered, every fee 0, no speed and no source. */
export const UNRESOLVED_QUOTE: ShippingQuote = {
  baseFee: 0,
  overweightFee: 0,
  totalFee: 0,
  resolved: false,
  speed: null,
  offeredSpeeds: [],
  freeShipping: false,
  waivedFee: 0,
  source: null,
};

const [STANDARD_SPEED] = DELIVERY_SPEEDS;

/** Whether the method is offered (D3125): the switches of {@link modesOf}, and desk needs a desk town. */
function isOffered({ communeRate, town, method }: DeliveryQuoteInput, wilaya: WilayaRateRow): boolean {
  const modes = modesOf(wilaya, communeRate);
  if (method === 'home') return modes.home;
  return modes.desk && (town === null || town.isStopdesk);
}

/** A commune row's price of the method, `override ?? base`; `null` when it sets none, which inherits (D3125). */
function communePriceOf(row: CommuneRateRow | null, method: DeliveryMethod): number | null {
  if (row === null) return null;
  return method === 'home' ? (row.overrideHome ?? row.baseHome) : (row.overrideDesk ?? row.baseDesk);
}

/** The wilaya row's price of the method, `override ?? base` (D3107). */
const wilayaPriceOf = (row: WilayaRateRow, method: DeliveryMethod): number =>
  method === 'home' ? (row.overrideHome ?? row.baseHome) : (row.overrideDesk ?? row.baseDesk);

/** The method's price and its layer (D3125): the commune's when it sets one, else the wilaya's. */
function priceOf(
  wilaya: WilayaRateRow,
  communeRate: CommuneRateRow | null,
  method: DeliveryMethod,
): { readonly price: number; readonly source: QuotePriceSource } {
  const communePrice = communePriceOf(communeRate, method);
  if (communePrice !== null) return { price: communePrice, source: 'commune' };
  return { price: wilayaPriceOf(wilaya, method), source: 'wilaya' };
}

/**
 * The overweight fee in integers (D3121): `ceil(max(0, grams − allowanceKg × 1000) / 1000) × rate`, 0 when the group
 * does not charge it; `null` for a weight that is not a whole, non-negative, safe number of grams.
 */
export function overweightFeeOf(group: OverweightSettings, weightGrams: number): number | null {
  if (!Number.isSafeInteger(weightGrams) || weightGrams < 0) return null;
  if (!group.chargeOverweight) return 0;
  const extraGrams = Math.max(0, weightGrams - group.overweightAllowanceKg * GRAMS_PER_KG);
  return Math.ceil(extraGrams / GRAMS_PER_KG) * group.overweightRate;
}

/**
 * Whether an amount is a whole DZD between 0 and `MONEY_MAX_DZD`. A stored price is checked too: the price columns
 * have no `CHECK (>= 0)` and a carrier sync writes the bases (D3125), so a negative row must never lower an order.
 */
const isMoney = (amount: number): boolean => Number.isSafeInteger(amount) && amount >= 0 && amount <= MONEY_MAX_DZD;

/**
 * The delivery quote of one destination and parcel (D3125, D3121, D3113), all in whole DZD. A wilaya without a row,
 * a method not offered, an unreadable weight, a stored price that is not a whole DZD ≥ 0 or a total above
 * `MONEY_MAX_DZD` answer {@link UNRESOLVED_QUOTE}. A waived delivery costs the buyer 0 and reports the base and
 * overweight it waived.
 */
export function quoteDelivery(input: DeliveryQuoteInput): ShippingQuote {
  const { rate, communeRate, method, group, weightGrams, waive } = input;
  if (rate === null || !isOffered(input, rate)) return UNRESOLVED_QUOTE;
  const overweightFee = overweightFeeOf(group, weightGrams);
  if (overweightFee === null) return UNRESOLVED_QUOTE;
  const { price, source } = priceOf(rate, communeRate, method);
  if (!isMoney(price)) return UNRESOLVED_QUOTE;
  const fee = price + overweightFee;
  if (!isMoney(fee)) return UNRESOLVED_QUOTE;
  return {
    baseFee: price,
    overweightFee,
    totalFee: waive ? 0 : fee,
    resolved: true,
    speed: STANDARD_SPEED,
    offeredSpeeds: [STANDARD_SPEED],
    freeShipping: waive,
    waivedFee: waive ? fee : 0,
    source,
  };
}
