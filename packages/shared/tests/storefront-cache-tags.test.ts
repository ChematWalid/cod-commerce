import { describe, expect, it } from 'vitest';
import { STORE_CACHE_TAG_PREFIX, storeCacheTag } from '../src/platform/storefront-cache-tags';

describe('storefront cache tags', () => {
  it('tags a store as store:{storeId} (the ADR 0006 contract)', () => {
    expect(storeCacheTag('demo')).toBe('store:demo');
  });

  it('gives two stores two different tags under the same prefix', () => {
    // Act
    const tags = [storeCacheTag('demo'), storeCacheTag('second')];
    // Assert
    expect(new Set(tags).size).toBe(2);
    expect(tags.every((tag) => tag.startsWith(STORE_CACHE_TAG_PREFIX))).toBe(true);
  });
});
