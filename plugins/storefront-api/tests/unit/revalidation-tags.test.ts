import { STOREFRONT_CACHE_TAG_PATTERN } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { revalidationTagsOf } from '../../domain/revalidation-target';

const STORE = '7340032000000001';

describe('revalidationTagsOf', () => {
  it('expires a product and the list pages of its store', () => {
    // Act
    const tags = revalidationTagsOf({ kind: 'product', storeId: STORE, productId: '12' });

    // Assert
    expect(tags).toEqual(['product:12', `store:${STORE}`]);
  });

  it('expires a collection and the list pages of its store', () => {
    // Act
    const tags = revalidationTagsOf({ kind: 'collection', storeId: STORE, collectionId: '3' });

    // Assert
    expect(tags).toEqual(['collection:3', `store:${STORE}`]);
  });

  it('expires every entry of a store whose settings, status or domain changed', () => {
    // Act
    const tags = revalidationTagsOf({ kind: 'store', storeId: STORE });

    // Assert
    expect(tags).toEqual([`store:${STORE}`]);
  });

  it('builds only tags the storefront accepts', () => {
    // Act
    const tags = [
      ...revalidationTagsOf({ kind: 'product', storeId: STORE, productId: '2147483647' }),
      ...revalidationTagsOf({ kind: 'collection', storeId: STORE, collectionId: '1' }),
    ];

    // Assert
    expect(tags.every((tag) => STOREFRONT_CACHE_TAG_PATTERN.test(tag))).toBe(true);
  });
});
