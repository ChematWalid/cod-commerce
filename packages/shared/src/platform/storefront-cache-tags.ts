/**
 * Prefix of the storefront cache tag that covers every cached entry of one store (ADR 0006: `store:{storeId}`).
 * The storefront tags its `'use cache'` entries with it; a store publish revalidates it.
 */
export const STORE_CACHE_TAG_PREFIX = 'store:';

/** The cache tag of every storefront entry of `storeId`, as the storefront sets it and a publish revalidates it. */
export function storeCacheTag(storeId: string): string {
  return `${STORE_CACHE_TAG_PREFIX}${storeId}`;
}
