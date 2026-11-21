import type { OperationContext } from './operation-context';

/**
 * The per-store lock every membership writer takes first in its transaction (D2334): rule-save recompute, the
 * `product.changed` consumer, manual product sets, the registered membership source, collection delete and reconcile.
 */
export interface StoreLockPort {
  /** Holds the store's lock until the transaction of `ctx` ends; refuses a context without a transaction. */
  lockStore(ctx: OperationContext, storeId: string): Promise<void>;
}
