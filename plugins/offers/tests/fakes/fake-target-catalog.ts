import type { OperationContext } from '../../domain/ports/operation-context.port';
import type { OfferCatalogRefs, OfferTargetCatalog } from '../../domain/ports/target-catalog.port';
import type { StoreScope } from '../../domain/store-scope';

const keyOf = (scope: StoreScope): string => `${scope.businessId}/${scope.storeId}`;

const NONE: OfferCatalogRefs = { variantIds: [], productIds: [], collectionIds: [] };

/**
 * The variants, products and collections of each store in memory (D2537, D2342). Until a test calls {@link stock},
 * every id is a row of every store, as most admin tests name made-up ids; afterwards a store holds only what was
 * stocked in it.
 */
export class FakeTargetCatalog implements OfferTargetCatalog {
  private readonly byStore = new Map<string, OfferCatalogRefs>();
  private restricted = false;
  /** The refs of every call, in order. */
  readonly calls: OfferCatalogRefs[] = [];

  /** Makes `refs` rows of `scope`'s store, beside those stocked before. */
  stock(scope: StoreScope, refs: Partial<OfferCatalogRefs>): void {
    this.restricted = true;
    const held = this.byStore.get(keyOf(scope)) ?? NONE;
    this.byStore.set(keyOf(scope), {
      variantIds: [...held.variantIds, ...(refs.variantIds ?? [])],
      productIds: [...held.productIds, ...(refs.productIds ?? [])],
      collectionIds: [...held.collectionIds, ...(refs.collectionIds ?? [])],
    });
  }

  /** Removes every row of `scope`'s store, as a deletion in the catalog would. */
  empty(scope: StoreScope): void {
    this.restricted = true;
    this.byStore.set(keyOf(scope), NONE);
  }

  existing(_ctx: OperationContext, scope: StoreScope, refs: OfferCatalogRefs): Promise<OfferCatalogRefs> {
    this.calls.push(refs);
    if (!this.restricted) return Promise.resolve(refs);
    const held = this.byStore.get(keyOf(scope)) ?? NONE;
    return Promise.resolve({
      variantIds: refs.variantIds.filter((id) => held.variantIds.includes(id)),
      productIds: refs.productIds.filter((id) => held.productIds.includes(id)),
      collectionIds: refs.collectionIds.filter((id) => held.collectionIds.includes(id)),
    });
  }
}
