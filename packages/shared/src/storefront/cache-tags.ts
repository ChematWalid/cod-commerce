/**
 * Storefront cache tags (ADR 0006): the storefront tags its `'use cache'` entries with them, and the revalidation
 * pipeline (outbox → `storefront-revalidate` → `/api/internal/revalidate`) expires them. Every id is a decimal string.
 */
export const STOREFRONT_CACHE_TAG_KINDS = ['store', 'product', 'collection', 'theme', 'offers'] as const;

/** One of the {@link STOREFRONT_CACHE_TAG_KINDS}. */
export type StorefrontCacheTagKind = (typeof STOREFRONT_CACHE_TAG_KINDS)[number];

/** Prefix of the tag that covers every cached entry of one store: `store:{storeId}`. */
export const STORE_CACHE_TAG_PREFIX = 'store:';

/** Exactly the tags this module builds: a known kind, a colon, an ADR 0003 decimal id. */
export const STOREFRONT_CACHE_TAG_PATTERN = /^(?:store|product|collection|theme|offers):[1-9][0-9]{0,18}$/;

function tagOf(kind: StorefrontCacheTagKind, id: string): string {
  return `${kind}:${id}`;
}

/** Tag of every storefront entry of `storeId`; a store publish or settings change expires it. */
export function storeTag(storeId: string): string {
  return tagOf('store', storeId);
}

/** Tag of the entries that show product `productId` (its page, cards in grids). */
export function productTag(productId: string): string {
  return tagOf('product', productId);
}

/** Tag of the entries that show collection `collectionId`. */
export function collectionTag(collectionId: string): string {
  return tagOf('collection', collectionId);
}

/** Tag of the entries rendered with the theme of `storeId`. */
export function themeTag(storeId: string): string {
  return tagOf('theme', storeId);
}

/** Tag of the entries that show the offers of `storeId`. */
export function offersTag(storeId: string): string {
  return tagOf('offers', storeId);
}

/** The P0.S2b name of {@link storeTag}, kept so existing callers keep working. */
export const storeCacheTag = storeTag;
