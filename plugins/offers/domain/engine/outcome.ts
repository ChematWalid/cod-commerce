import type { DeliveryMethod, SkipReason } from '@cod/shared';
import type { AddonItem, RunningLine } from '../cart';
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

/**
 * What a kind calculator reads for one offer: the offer, its parsed config, the running lines, the bases and the
 * add-ons the buyer accepted for this offer (none unless its kind offers add-ons, D2506).
 */
export interface KindInput<C> {
  readonly offer: Offer;
  readonly config: C;
  readonly lines: readonly RunningLine[];
  readonly base: PricingBase;
  readonly delivery: DeliveryContext;
  readonly addons: readonly AddonItem[];
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

/**
 * Units gifted off matched lines (D2504): `gifts` holds the units split off each line, by line key, and `unitPrices`
 * the price of one gifted unit of that line; `value` is what the buyer no longer pays for them.
 */
export interface GiftOutcome {
  readonly kind: 'gift';
  readonly gifts: ReadonlyMap<string, number>;
  readonly unitPrices: ReadonlyMap<string, number>;
  readonly value: number;
  /** Whether the cart holds a buy line of the offer: an earned gift whose get item is missing still names one (D2530). */
  readonly namesLine: boolean;
}

/**
 * Add-on lines appended to the cart at the add-on price (D2506): each keyed `<variantId>:addon:<offerId>` with
 * `addonOf` and `parentVariantId` set; `value` is what the buyer saves on them against their list price.
 */
export interface AddonOutcome {
  readonly kind: 'addon';
  readonly lines: readonly RunningLine[];
  readonly value: number;
}

/** What one offer does to a cart. */
export type OfferOutcome = SkipOutcome | LineOutcome | OrderOutcome | DeliveryOutcome | GiftOutcome | AddonOutcome;

/** An outcome that does something to the cart, or would: every outcome but a skip. */
export type EffectOutcome = Exclude<OfferOutcome, { kind: 'skip' }>;

/**
 * Whether an effect does nothing, by effect kind (§3a.7): an add-on the buyer chose counts by its lines, even at no
 * saving (a fixed price at the list price, D2507); every other effect by its value to the buyer.
 */
const IS_EMPTY_BY_EFFECT: {
  readonly [K in EffectOutcome['kind']]: (outcome: Extract<EffectOutcome, { kind: K }>) => boolean;
} = {
  line: (outcome) => outcome.value === 0,
  gift: (outcome) => outcome.value === 0,
  order: (outcome) => outcome.value === 0,
  delivery: (outcome) => outcome.value === 0,
  addon: (outcome) => outcome.lines.length === 0,
};

/** Whether `outcome` does nothing to the cart. */
export const isEmptyEffect = (outcome: EffectOutcome): boolean =>
  (IS_EMPTY_BY_EFFECT[outcome.kind] as (outcome: EffectOutcome) => boolean)(outcome);
