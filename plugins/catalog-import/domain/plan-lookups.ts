/** What one SKU names in the active store (catalog's `findBySkus`, D2201): ids as strings. */
export type SkuLookup =
  | { readonly kind: 'none' }
  | { readonly kind: 'one'; readonly productId: string; readonly variantId: string | null }
  | { readonly kind: 'ambiguous' };

/**
 * What a plan reads of the active store, looked up before planning (D2209): each SKU of the file, the `id:<n>` keys
 * that name a product of the store, the store's brands and tags by `taxonomyKey`, and whether the actor may
 * edit products (D2207). Another store's or business's SKU or id is simply absent.
 */
export interface PlanLookups {
  readonly skus: ReadonlyMap<string, SkuLookup>;
  readonly productIds: ReadonlySet<string>;
  readonly brands: ReadonlyMap<string, string>;
  readonly tags: ReadonlyMap<string, string>;
  readonly canUpdate: boolean;
}
