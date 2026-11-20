import type { DeliveryMethod, SkipReason } from '@cod/shared';
import type { RunningLine } from '../cart';
import type { Offer } from '../offer';
import type { ShippingQuoteResult } from '../snapshot';

/** The cart amounts thresholds are measured on (D2412): subtotal after line offers and the number of pieces. */
export interface PricingBase {
  readonly subtotal: number;
  readonly pieces: number;
}

/** The shipping quote plus the method the destination asks for (`null` without a destination). */
export interface DeliveryContext extends ShippingQuoteResult {
  readonly method: DeliveryMethod | null;
}

/** What a kind calculator reads for one offer: the offer, its parsed config, the running lines and the bases. */
export interface KindInput<C> {
  readonly offer: Offer;
  readonly config: C;
  readonly lines: readonly RunningLine[];
  readonly base: PricingBase;
  readonly delivery: DeliveryContext;
}

/** The offer does not apply, for `reason`. */
export interface SkipOutcome {
  readonly kind: 'skip';
  readonly reason: SkipReason;
}

/** A per-unit discount on lines, by line key; `freeDelivery` when a quantity tier waives delivery (D2413). */
export interface LineOutcome {
  readonly kind: 'line';
  readonly unitDiscounts: ReadonlyMap<string, number>;
  /** Buyer saving used to rank candidates (D2411), waived fee included. */
  readonly value: number;
  readonly freeDelivery: boolean;
}

/** A discount on the order of `amount` DZD. */
export interface OrderOutcome {
  readonly kind: 'order';
  readonly amount: number;
  readonly value: number;
}

/** Delivery waived; `value` is the fee the buyer no longer pays (D2414). */
export interface DeliveryOutcome {
  readonly kind: 'delivery';
  readonly value: number;
}

/** What one offer does to a cart. */
export type OfferOutcome = SkipOutcome | LineOutcome | OrderOutcome | DeliveryOutcome;
