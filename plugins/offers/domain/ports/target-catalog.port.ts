import type { StoreScope } from '../store-scope';
import type { OfferTargetRefs } from './offer-repository.port';
import type { OperationContext } from './operation-context.port';

/**
 * The catalog rows an offer target may name (D2537): the variants and products of the store, as its channel holds
 * them. The caller has proved that `ctx` is on the store's own channel (D2448).
 */
export interface OfferTargetCatalog {
  /**
   * The ids among `refs` that are variants and products of `scope`'s store and not deleted; an id of another store or
   * business, or an unknown one, is simply absent. Disabled and hidden rows count: an offer may be prepared for them.
   */
  existing(ctx: OperationContext, scope: StoreScope, refs: OfferTargetRefs): Promise<OfferTargetRefs>;
}
