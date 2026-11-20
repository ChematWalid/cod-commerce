import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/**
 * Where the total uses of a store's offers and codes are counted (D2447): the `usageCount` columns the total and
 * per-code limits read (D2418). Each call is confined to the scope's business and store and joins the transaction
 * `ctx` carries, so an order's uses commit or roll back with the order.
 */
export interface OfferUsageCounterPort {
  /** Adds one use of offer `offerId` while it is under its total limit; `false` at the limit or for no such offer. */
  recordOfferUse(ctx: OperationContext, scope: StoreScope, offerId: string): Promise<boolean>;

  /** Adds one use of code `code` (normalised first) while under its limit; `false` at the limit or for no such code. */
  recordCodeUse(ctx: OperationContext, scope: StoreScope, code: string): Promise<boolean>;

  /** Gives one use of offer `offerId` back; `false` when its count is already 0 or there is no such offer. */
  releaseOfferUse(ctx: OperationContext, scope: StoreScope, offerId: string): Promise<boolean>;

  /** Gives one use of code `code` (normalised first) back; `false` when its count is 0 or there is no such code. */
  releaseCodeUse(ctx: OperationContext, scope: StoreScope, code: string): Promise<boolean>;
}
