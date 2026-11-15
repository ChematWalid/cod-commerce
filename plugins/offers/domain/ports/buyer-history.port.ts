import type { BuyerRef } from '../cart';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/**
 * How many orders a buyer already has in the store, for audience offers (D2418). P3.S4 registers its source on
 * `BUYER_HISTORY_REGISTRAR`; until then no order exists, so every phone is a first-time buyer.
 */
export interface BuyerHistory {
  /**
   * Orders of the buyer (by E.164 phone) in the store, the repriced order included: re-pricing gives that one back
   * (D2427), so a source must not leave it out itself.
   */
  orderCountOf(ctx: OperationContext, scope: StoreScope, buyer: BuyerRef): Promise<number>;
}

/** Where P3.S4 registers its {@link BuyerHistory} (injected as `BUYER_HISTORY_REGISTRAR`). */
export interface BuyerHistoryRegistrar {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(source: BuyerHistory): void;
}
