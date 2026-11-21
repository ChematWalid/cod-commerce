import type { Snowflake } from '../ids/snowflake';

/** What applied an offer outside checkout; P3.S4 intake adds its own source (D2509). */
export const OFFER_APPLIED_SOURCES = ['post_order_addon'] as const;

/** One of the {@link OFFER_APPLIED_SOURCES}. */
export type OfferAppliedSource = (typeof OFFER_APPLIED_SOURCES)[number];

/**
 * The payload of an `offer.applied` outbox event (D2509): which offer gave what to which order. Ids are decimal
 * strings; `amount` is the buyer saving in whole DZD. Consumers read the order and the offer under their own tenant
 * scope.
 */
export type OfferAppliedPayload = {
  readonly offerId: Snowflake;
  readonly kind: string;
  readonly orderId: Snowflake;
  readonly storeId: Snowflake;
  readonly amount: number;
  readonly source: OfferAppliedSource;
};
