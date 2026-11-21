import type { AddonPlacement, DeliveryMethod, PricingChannel, QuoteDestination } from '@cod/shared';
import { ADDON_KEY_SEPARATOR, GIFT_KEY_SEPARATOR } from './constants';

/** The buyer of a quote, server-side only: the phone in E.164, never in a response (D2418). */
export interface BuyerRef {
  readonly phone: string;
}

/**
 * A cart line the variant gate accepted, at its unit price before offers. `productId` always comes from the gate,
 * never from the request (D2423); `key` is the variant id once lines of one variant are merged (D2428).
 */
export interface PricedLine {
  readonly key: string;
  readonly productId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly originalPrice: number;
  readonly collectionIds: readonly string[];
}

/**
 * A priced line with the unit price line offers have reached so far (D2411). `giftOf` marks a gift line a buy-x-get-y
 * offer split off a matched line (D2504), `addonOf` an add-on line an add-on offer priced (D2506): no line offer reads
 * either.
 */
export interface RunningLine extends PricedLine {
  readonly unitPrice: number;
  readonly giftOf?: string;
  readonly addonOf?: string;
  /** On an add-on line: the cart variant it rides with, or null for an add-on offered on any order (D2506). */
  readonly parentVariantId?: string | null;
}

/** The key of the gift line `offerId` splits off the lines of `variantId` (D2504): `<variantId>:gift:<offerId>`. */
export function giftLineKey(variantId: string, offerId: string): string {
  return `${variantId}${GIFT_KEY_SEPARATOR}${offerId}`;
}

/** The key of the add-on line of `variantId` that `offerId` prices (D2506): `<variantId>:addon:<offerId>`. */
export function addonLineKey(variantId: string, offerId: string): string {
  return `${variantId}${ADDON_KEY_SEPARATOR}${offerId}`;
}

/** An add-on variant as the gate priced it: its product, unit price before offers and collections (D2506). */
export interface AddonPricing {
  readonly productId: string;
  readonly originalPrice: number;
  readonly collectionIds: readonly string[];
}

/** An add-on the buyer accepted (D2506): the offer offering it, the variant, how many and its gated price. */
export interface CartAddon {
  readonly offerId: string;
  readonly variantId: string;
  readonly quantity: number;
  /** The gate's price of the variant, or null when the gate refused it (`unavailable`, never a failed quote). */
  readonly priced: AddonPricing | null;
}

/** An add-on an offer reads: one the buyer accepted for it, offered by it and priced by the gate (D2506). */
export interface AddonItem extends AddonPricing {
  readonly variantId: string;
  readonly quantity: number;
}

/** Where the order goes; `null` before the buyer chooses. */
export type PricingDestination = Readonly<QuoteDestination> | null;

/**
 * What the engine prices: accepted lines, the asking channel, destination, buyer, codes as typed, the add-ons the
 * buyer accepted and the placement they were offered on (D2506: `order_form` at checkout, `thank_you` after it).
 */
export interface PricingCart {
  readonly channel: PricingChannel;
  readonly lines: readonly PricedLine[];
  readonly destination: PricingDestination;
  readonly buyer: BuyerRef | null;
  readonly codes: readonly string[];
  readonly addons: readonly CartAddon[];
  readonly addonPlacement: AddonPlacement;
}

/** The delivery method of a destination: a stop desk or the buyer's home; `null` without a destination. */
export function deliveryMethodOf(destination: PricingDestination): DeliveryMethod | null {
  if (destination === null) return null;
  return destination.stopdesk ? 'desk' : 'home';
}
