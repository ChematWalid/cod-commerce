import { collectionTag, productTag, storeTag } from '@cod/shared';

/** What an outbox event changed on a storefront, as the revalidation sees it: ids only, each well formed. */
export type RevalidationTarget =
  | { readonly kind: 'product'; readonly storeId: string; readonly productId: string }
  | { readonly kind: 'collection'; readonly storeId: string; readonly collectionId: string }
  | { readonly kind: 'store'; readonly storeId: string };

/**
 * The storefront cache tags a change expires (ADR 0006): the product or collection itself and `store:<id>`, which the
 * list, collection and search pages of the store carry; a store change expires every entry of the store.
 */
export function revalidationTagsOf(target: RevalidationTarget): readonly string[] {
  const store = storeTag(target.storeId);
  if (target.kind === 'product') return [productTag(target.productId), store];
  if (target.kind === 'collection') return [collectionTag(target.collectionId), store];
  return [store];
}
