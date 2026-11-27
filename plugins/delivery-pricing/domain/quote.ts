import { DELIVERY_SPEEDS, MAX_OVERWEIGHT_ALLOWANCE_KG, MAX_OVERWEIGHT_RATE, type ShippingQuote } from '@cod/shared';
import { GRAMS_PER_KG } from './constants';
import type { CommuneRateRow, FeeGroupSettings, WilayaRateRow } from './fee-group';
import { type DeliveryMethod, isBoundedInt, isQuotablePrice, methodPriceOf } from './method-price';
import { modesOf } from './store-modes';

export { type DeliveryMethod, isQuotablePrice } from './method-price';

/** What the quote reads of a named commune in the geo reference data: whether a carrier desk and home delivery are there. */
export interface QuoteTown {
  readonly isStopdesk: boolean;
  readonly isHomeDelivery: boolean;
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

/**
 * Whether the method is offered (D3125): the switches and price validity of {@link modesOf}; home needs a home-delivery town and desk a
 * desk town, the same AND geo applies to the commune list (D3133), so the list and the quote never disagree.
 */
function isOffered({ communeRate, town, method }: DeliveryQuoteInput, wilaya: WilayaRateRow): boolean {
  const modes = modesOf(wilaya, communeRate);
  if (method === 'home') return modes.home && (town === null || town.isHomeDelivery);
  return modes.desk && (town === null || town.isStopdesk);
}

/**
 * The overweight fee in integers (D3121): `ceil(max(0, grams − allowanceKg × 1000) / 1000) × rate`, 0 when the group
 * does not charge it; `null` for a weight that is not a whole, non-negative, safe number of grams, or for a charging
 * group whose stored allowance or rate is outside its input bounds (checked like a stored price, D3134).
 */
export function overweightFeeOf(group: OverweightSettings, weightGrams: number): number | null {
  if (!Number.isSafeInteger(weightGrams) || weightGrams < 0) return null;
  if (!group.chargeOverweight) return 0;
  if (!isBoundedInt(group.overweightAllowanceKg, MAX_OVERWEIGHT_ALLOWANCE_KG)) return null;
  if (!isBoundedInt(group.overweightRate, MAX_OVERWEIGHT_RATE)) return null;
  const extraGrams = Math.max(0, weightGrams - group.overweightAllowanceKg * GRAMS_PER_KG);
  return Math.ceil(extraGrams / GRAMS_PER_KG) * group.overweightRate;
}

/**
 * The delivery quote of one destination and parcel (D3125, D3121, D3113), all in whole DZD. A wilaya without a row,
 * a method not offered, an unreadable weight, a stored price that is not a whole DZD ≥ 0, a stored overweight setting
 * out of its bounds or a total above `MONEY_MAX_DZD` answer {@link UNRESOLVED_QUOTE}. A waived delivery costs the
 * buyer 0 and reports the base and overweight it waived.
 */
export function quoteDelivery(input: DeliveryQuoteInput): ShippingQuote {
  const { rate, communeRate, method, group, weightGrams, waive } = input;
  if (rate === null || !isOffered(input, rate)) return UNRESOLVED_QUOTE;
  const overweightFee = overweightFeeOf(group, weightGrams);
  if (overweightFee === null) return UNRESOLVED_QUOTE;
  const { price, source } = methodPriceOf(rate, communeRate, method);
  if (!isQuotablePrice(price)) return UNRESOLVED_QUOTE;
  const fee = price + overweightFee;
  if (!isQuotablePrice(fee)) return UNRESOLVED_QUOTE;
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
