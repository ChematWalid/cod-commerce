import type { Offer } from './offer';

/** The delivery fee table's answer for a destination; unresolved means fees 0 until P3.S1 (D2423). */
export interface ShippingQuoteResult {
  readonly resolved: boolean;
  readonly baseFee: number;
  readonly overweightFee: number;
  readonly speed: string | null;
}

/** A stored discount code of the store, by its normalised text (D2406). */
export interface CodeEntry {
  readonly offerId: string;
  readonly usageLimit: number | null;
  readonly usageCount: number;
}

/**
 * Everything one quote reads, loaded before the engine runs so the engine stays pure (ADR 0004, D2424): the store's
 * active offers, its codes, the buyer's usage per offer and order count (`null` without a phone), the shipping quote
 * and the instant the quote is made at.
 */
export interface PricingSnapshot {
  readonly offers: readonly Offer[];
  readonly codes: ReadonlyMap<string, CodeEntry>;
  /** Uses of each offer by this buyer, by offer id; a missing id means none. */
  readonly perBuyerUsage: ReadonlyMap<string, number>;
  readonly buyerOrderCount: number | null;
  readonly shipping: ShippingQuoteResult;
  readonly now: Date;
}
