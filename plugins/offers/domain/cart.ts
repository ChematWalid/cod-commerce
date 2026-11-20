import type { DeliveryMethod, PricingChannel, QuoteDestination } from '@cod/shared';
import { GIFT_KEY_SEPARATOR } from './constants';

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
 * offer split off a matched line (D2504): no later line offer reads it.
 */
export interface RunningLine extends PricedLine {
  readonly unitPrice: number;
  readonly giftOf?: string;
}

/** The key of the gift line `offerId` splits off the lines of `variantId` (D2504): `<variantId>:gift:<offerId>`. */
export function giftLineKey(variantId: string, offerId: string): string {
  return `${variantId}${GIFT_KEY_SEPARATOR}${offerId}`;
}

/** Where the order goes; `null` before the buyer chooses. */
export type PricingDestination = Readonly<QuoteDestination> | null;

/** What the engine prices: accepted lines, the asking channel, destination, buyer and codes as typed. */
export interface PricingCart {
  readonly channel: PricingChannel;
  readonly lines: readonly PricedLine[];
  readonly destination: PricingDestination;
  readonly buyer: BuyerRef | null;
  readonly codes: readonly string[];
}

/** The delivery method of a destination: a stop desk or the buyer's home; `null` without a destination. */
export function deliveryMethodOf(destination: PricingDestination): DeliveryMethod | null {
  if (destination === null) return null;
  return destination.stopdesk ? 'desk' : 'home';
}
