import type { WilayaCode } from '@cod/shared';

/** One cart line a delivery is quoted for: the product, how many and, when the caller knows it, one unit's weight. */
export interface ShippingQuoteItem {
  readonly productId: string;
  readonly quantity: number;
  /** The weight of one unit in grams (a pack's weight mode, D2441); else the product's weight is read (D3119). */
  readonly weightGrams?: number;
}

/**
 * A delivery quote request for one store: the wilaya, optionally the commune's ONS code (`townOns`), home or stop
 * desk, the lines and whether an offer waives the fee. The store scope comes from the signed host or the session,
 * never from a request body.
 */
export interface ShippingQuoteRequest {
  readonly provinceCode: WilayaCode;
  readonly townOns?: number;
  readonly stopdesk: boolean;
  readonly items: readonly ShippingQuoteItem[];
  readonly waive?: boolean;
}

/** The products whose weight must be read: those of lines that send no unit weight, each once. */
export function productsWithoutWeight(items: readonly ShippingQuoteItem[]): string[] {
  return [...new Set(items.filter((item) => item.weightGrams === undefined).map((item) => item.productId))];
}

const isCount = (value: number): boolean => Number.isSafeInteger(value) && value >= 1;
const isGrams = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

/**
 * Whether every line reads: a whole quantity ≥ 1 and, when sent, a whole unit weight ≥ 0 g (D3133). Checked whatever
 * the group's overweight setting, without reading any product weight.
 */
export function isReadableParcel(items: readonly ShippingQuoteItem[]): boolean {
  return items.every((item) => isCount(item.quantity) && (item.weightGrams === undefined || isGrams(item.weightGrams)));
}

/**
 * The parcel's weight in grams: each line's unit weight (sent, else the product's; a null or unknown product weight
 * counts as 0 g, D3119) times its quantity. A line with an unreadable quantity or weight gives `NaN`; a sum past the
 * safe integers is left as is. The quote answers both unresolved, never a wrong total.
 */
export function parcelWeightOf(
  items: readonly ShippingQuoteItem[],
  productWeights: ReadonlyMap<string, number | null>,
): number {
  let total = 0;
  for (const item of items) {
    const unit = item.weightGrams ?? productWeights.get(item.productId) ?? 0;
    if (!isCount(item.quantity) || !isGrams(unit)) return Number.NaN;
    total += unit * item.quantity;
  }
  return total;
}
