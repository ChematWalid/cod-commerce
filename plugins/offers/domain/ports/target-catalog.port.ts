import type { StoreScope } from '../store-scope';
import type { OfferTargetRefs } from './offer-repository.port';
import type { OperationContext } from './operation-context.port';

/** The ids an offer's targets name, by type, as the store check reads them (D2537, D2342). */
export interface OfferCatalogRefs extends OfferTargetRefs {
  readonly collectionIds: readonly string[];
}

/**
 * The catalog rows an offer target may name (D2537, D2342): the variants, products and collections of the store. The
 * caller has proved that `ctx` is on the store's own channel (D2448).
 */
export interface OfferTargetCatalog {
  /**
   * The ids among `refs` that are variants, products and collections of `scope`'s store and not deleted; an id of
   * another store or business, or an unknown one, is simply absent. Disabled and hidden rows count: an offer may be
   * prepared for them.
   */
  existing(ctx: OperationContext, scope: StoreScope, refs: OfferCatalogRefs): Promise<OfferCatalogRefs>;
}
