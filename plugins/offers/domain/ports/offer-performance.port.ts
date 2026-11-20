import type { OfferOrderFact } from '../performance';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/**
 * The orders that applied a store's offers, for the offer stats (D2514). P3.S4 (orders) registers its source on
 * `OFFER_PERFORMANCE_SOURCE_REGISTRAR`; until then no order exists, so every offer's stats are zeros.
 */
export interface OfferPerformanceSource {
  /** The orders of `scope`'s store that applied one of `offerIds`; never an order of another store. */
  factsOf(ctx: OperationContext, scope: StoreScope, offerIds: readonly string[]): Promise<readonly OfferOrderFact[]>;
}

/** Where P3.S4 registers its {@link OfferPerformanceSource} (injected as `OFFER_PERFORMANCE_SOURCE_REGISTRAR`). */
export interface OfferPerformanceRegistrar {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(source: OfferPerformanceSource): void;
}
