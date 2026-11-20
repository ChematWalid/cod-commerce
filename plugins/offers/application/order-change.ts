import type { Quote, QuoteRequestInput } from '@cod/shared';
import type { OrderUsage } from '../domain/engine/order-usage';
import type { TokenUse } from '../domain/engine/priced-quote';

/**
 * An order change to price (D2427): the order's cart as it is and as it would be. Both carts are priced at today's
 * snapshot, so every line of the changed cart, touched or not, gets today's price (D2446).
 */
export interface RepriceInput {
  readonly current: QuoteRequestInput;
  readonly next: QuoteRequestInput;
  /**
   * The total the order stores now (Vendure `totalWithTax`: the intake token's `t`, then the last saved change's
   * `after.total`), whole DZD. `delta` is measured from it, so it is the change the edit makes to the stored order
   * even when prices moved since intake (D2446).
   */
  readonly storedTotal: number;
  /**
   * The offers and codes the order already holds. The stored usage counts include this order's own uses, so both carts
   * are priced with them given back; without it an order that took an offer's last use would lose the offer on edit.
   * The caller builds it with `orderUsageOf` from the order's stored `appliedOffers` (the intake token's `o`, then
   * `OrderFields.appliedOffers` after each saved change, D2445), never from a request body: lines' `offerIds` and
   * `quoteDiscounts` miss the code of a line offer and every delivery offer. The buyer's own uses and order count are given back only for a cart that keeps the phone of
   * `current`, the order as stored; `buyerOrdersBefore`, the buyer's order count the order recorded when it was
   * created (null or omitted when it recorded none), keeps a buyer's first order first after the buyer orders again
   * (D2442).
   */
  readonly orderUsage: OrderUsage;
}

/** One order line as the order stores it (ADR 0004 `quotedUnitPrice`). */
export interface OrderFieldLine {
  readonly variantId: string;
  readonly quotedUnitPrice: number;
  readonly originalPrice: number;
  readonly offerIds: readonly string[];
}

/** The order custom fields of the changed cart (ADR 0004); P4.S3 writes them, the pricing service never does. */
export interface OrderFields {
  readonly lines: readonly OrderFieldLine[];
  /** JSON of the token's order discounts `d`. */
  readonly quoteDiscounts: string;
  readonly quotedShipping: number;
  /**
   * Every offer the changed cart applied, with the code that activated it (D2445): what the order holds, to store and
   * to rebuild the next edit's `orderUsage` from (`orderUsageOf`).
   */
  readonly appliedOffers: readonly TokenUse[];
  /**
   * The buyer's orders before this one, to store on the order in place of the count it holds (D2442): the recorded
   * count while the changed cart keeps the order's phone, the new phone's own count when the edit changes it, null
   * without a phone. A count belongs to one phone, so P4.S3 overwrites the stored one on every saved change.
   */
  readonly buyerOrdersBefore: number | null;
}

/**
 * An order change whose carts are both fully priced: the change of the stored total and the new cart's order fields
 * (D2427, D2446). Its
 * quotes carry no token (`quoteToken` and `expiresAt` null): they are priced with the order's uses given back, so a
 * token would carry a released limit to a new checkout.
 */
export interface PricedOrderChange {
  readonly available: true;
  /** The order's current cart at today's prices, offers and fees. */
  readonly before: Quote;
  readonly after: Quote;
  /** `after.total − storedTotal`: what the change does to the stored order total, for the timeline audit diff. */
  readonly delta: number;
  /**
   * `before.total − storedTotal`: the part of `delta` that comes from prices, offers or fees that moved since the
   * order was priced, not from the edit (0 when nothing moved).
   */
  readonly drift: number;
  readonly orderFields: OrderFields;
}

/**
 * An order change with a variant the gate refuses in either cart: no delta and no order fields, since both would
 * silently leave the refused line out (D2425: never commit over a partial cart).
 */
export interface UnpricedOrderChange {
  readonly available: false;
  readonly before: Quote;
  readonly after: Quote;
  /** The refused variants of both carts, each once. */
  readonly unavailableVariantIds: readonly string[];
}

/** Both quotes of an order change, priced only when every line of both carts is available (D2425, D2427). */
export type RepriceResult = PricedOrderChange | UnpricedOrderChange;
