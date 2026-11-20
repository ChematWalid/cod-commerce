import type { OrderUsage } from '../domain/engine/order-usage';
import type { OfferUsageCounterPort } from '../domain/ports/offer-usage-counter.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';
import { parseOrderUsage } from './order-usage.schema';

/** What the usage use case reaches the counts through. */
export interface OfferUsagePorts {
  readonly counter: OfferUsageCounterPort;
}

/** The uses an order could not take: their offer or code was already at its limit (or is not the store's). */
export interface RecordedOrderUses {
  readonly refusedOfferIds: readonly string[];
  readonly refusedCodes: readonly string[];
}

/**
 * Counts the total uses of a store's offers and codes for its orders (D2447): P3.S4 records an order's uses at intake
 * and gives them back when the order is cancelled or rejected; P4.S3 moves them on a saved edit. Each count joins the
 * transaction `ctx` carries, so the uses commit or roll back with the order. Build the uses with `orderUsageOf` from
 * the token's `o` or the order's stored `appliedOffers` (D2445); business and store come from `scope` only.
 */
export class OfferUsageService {
  constructor(private readonly ports: OfferUsagePorts) {}

  /**
   * Adds one use of each offer and code of `uses` that is under its limit and reports the others, which stay at
   * their limit: the quote token is a commitment (ADR 0004), so what to do with an order that raced another for the
   * last use is the caller's decision.
   *
   * @throws {@link InvalidQuoteRequestError} when `uses` breaks the order usage bounds.
   */
  async recordOrderUses(ctx: OperationContext, scope: StoreScope, uses: OrderUsage): Promise<RecordedOrderUses> {
    const { offerIds, codes } = parseOrderUsage(uses);
    const refusedOfferIds: string[] = [];
    for (const offerId of offerIds) {
      if (!(await this.ports.counter.recordOfferUse(ctx, scope, offerId))) refusedOfferIds.push(offerId);
    }
    const refusedCodes: string[] = [];
    for (const code of codes) {
      if (!(await this.ports.counter.recordCodeUse(ctx, scope, code))) refusedCodes.push(code);
    }
    return { refusedOfferIds, refusedCodes };
  }

  /**
   * Gives one use of each offer and code of `uses` back; a count already at 0 stays there.
   *
   * @throws {@link InvalidQuoteRequestError} when `uses` breaks the order usage bounds.
   */
  async releaseOrderUses(ctx: OperationContext, scope: StoreScope, uses: OrderUsage): Promise<void> {
    const { offerIds, codes } = parseOrderUsage(uses);
    for (const offerId of offerIds) await this.ports.counter.releaseOfferUse(ctx, scope, offerId);
    for (const code of codes) await this.ports.counter.releaseCodeUse(ctx, scope, code);
  }
}
