import type { OfferPerformance } from '@cod/shared';
import { aggregatePerformance } from '../domain/performance';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { OfferPerformanceSource } from '../domain/ports/offer-performance.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';
import type { SourceHolder } from './single-source.registry';
import { assertOnChannelOf } from './store-channel';

/** What the stats use case reaches the orders through. */
export interface OfferStatsPorts {
  /** Checks every call's `ctx` is on `scope`'s store channel (D2448). */
  readonly stores: ActiveStorePort;
  /** The registered order source, or none until P3.S4 (D2514). */
  readonly performance: SourceHolder<OfferPerformanceSource>;
}

/**
 * The performance of a store's offers (D2514): orders, delivered revenue and discount given, computed on read from
 * the orders that applied them (D2529). Zeros until P3.S4 registers its order source.
 */
export class OfferStatsService {
  constructor(private readonly ports: OfferStatsPorts) {}

  /**
   * The performance of each offer of `offerIds`, by offer id; an offer no order applied answers zeros.
   *
   * @throws {@link NoActiveStoreError} when `ctx` is not on `scope`'s store channel.
   */
  async performanceOf(
    ctx: OperationContext,
    scope: StoreScope,
    offerIds: readonly string[],
  ): Promise<ReadonlyMap<string, OfferPerformance>> {
    await assertOnChannelOf(this.ports.stores, ctx, scope);
    const facts = await this.ports.performance.current().factsOf(ctx, scope, offerIds);
    return aggregatePerformance(facts, offerIds);
  }
}
