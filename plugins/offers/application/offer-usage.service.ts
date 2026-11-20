import type { OrderUsage } from '../domain/engine/order-usage';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { OfferUsageCounterPort } from '../domain/ports/offer-usage-counter.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';
import { parseOrderUsage } from './order-usage.schema';
import { assertOnOwnChannelOf } from './store-channel';

/** What the usage use case reaches the counts through. */
export interface OfferUsagePorts {
  readonly counter: OfferUsageCounterPort;
  /** Checks every call's `ctx` is on `scope`'s store channel, archived or not (D2448). */
  readonly stores: ActiveStorePort;
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
 * the token's `o` or the order's stored `appliedOffers` (D2445); business and store come from `scope` only, and a call
 * whose `ctx` is not on `scope`'s store channel is refused with `NoActiveStoreError` (D2448). A job or worker must
 * therefore call with a context on the order's store channel. An archived store's orders still record and give back
 * their uses on that channel: an order in flight when its store was archived can still be cancelled or rejected.
 */
export class OfferUsageService {
  constructor(private readonly ports: OfferUsagePorts) {}

  /**
   * Adds one use of each offer and code of `uses` that is under its limit and reports the others, which stay at
   * their limit: the quote token is a commitment (ADR 0004), so what to do with an order that raced another for the
   * last use is the caller's decision.
   *
   * @throws {@link InvalidQuoteRequestError} when `uses` breaks the order usage bounds.
   * @throws {@link NoActiveStoreError} when `ctx` is not on `scope`'s store channel (an archived store's is accepted).
   */
  async recordOrderUses(ctx: OperationContext, scope: StoreScope, uses: OrderUsage): Promise<RecordedOrderUses> {
    await assertOnOwnChannelOf(this.ports.stores, ctx, scope);
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
   * @throws {@link NoActiveStoreError} when `ctx` is not on `scope`'s store channel (an archived store's is accepted).
   */
  async releaseOrderUses(ctx: OperationContext, scope: StoreScope, uses: OrderUsage): Promise<void> {
    await assertOnOwnChannelOf(this.ports.stores, ctx, scope);
    const { offerIds, codes } = parseOrderUsage(uses);
    for (const offerId of offerIds) await this.ports.counter.releaseOfferUse(ctx, scope, offerId);
    for (const code of codes) await this.ports.counter.releaseCodeUse(ctx, scope, code);
  }
}
