import type { BuyerRef } from '../cart';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/**
 * How often a buyer already used each offer, for per-buyer limits (D2418). P3.S4 registers its counts on
 * `OFFER_USAGE_REGISTRAR`; until then every count is 0. Total limits read the stored `usageCount` instead.
 */
export interface OfferUsageCounts {
  /** Uses of each offer among `offerIds` by the buyer, by offer id; a missing offer was never used. */
  perBuyer(
    ctx: OperationContext,
    scope: StoreScope,
    offerIds: readonly string[],
    buyer: BuyerRef,
  ): Promise<ReadonlyMap<string, number>>;
}

/** Where P3.S4 registers its {@link OfferUsageCounts} (injected as `OFFER_USAGE_REGISTRAR`). */
export interface OfferUsageRegistrar {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(source: OfferUsageCounts): void;
}
