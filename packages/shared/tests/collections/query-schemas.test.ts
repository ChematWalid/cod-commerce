import { describe, expect, it } from 'vitest';
import {
  COLLECTION_LIST_PAGE_SIZE,
  COLLECTION_MAX_MANUAL_PRODUCTS,
  SLUG_MAX,
  storeCollectionProductsQuerySchema,
  storeCollectionSlugQuerySchema,
} from '../../src/index';

describe('storeCollectionProductsQuerySchema', () => {
  it('defaults to the first page and reads a REST query string', () => {
    // Act
    const empty = storeCollectionProductsQuerySchema.parse({});
    const fromQuery = storeCollectionProductsQuerySchema.parse({ skip: '20', take: '10' });

    // Assert
    expect(empty).toEqual({ skip: 0, take: COLLECTION_LIST_PAGE_SIZE });
    expect(fromQuery).toEqual({ skip: 20, take: 10 });
  });

  it('allows a whole manual collection on one page and no more', () => {
    // Act
    const whole = storeCollectionProductsQuerySchema.safeParse({ take: COLLECTION_MAX_MANUAL_PRODUCTS });
    const tooMany = storeCollectionProductsQuerySchema.safeParse({ take: COLLECTION_MAX_MANUAL_PRODUCTS + 1 });

    // Assert
    expect(whole.success).toBe(true);
    expect(tooMany.success).toBe(false);
  });

  it('refuses a negative, fractional or non-decimal page number', () => {
    for (const options of [{ skip: -1 }, { take: 1.5 }, { skip: '1e3' }, { take: 0 }]) {
      expect(storeCollectionProductsQuerySchema.safeParse(options).success).toBe(false);
    }
  });
});

describe('storeCollectionSlugQuerySchema', () => {
  it('trims the slug and keeps the collection being edited', () => {
    // Act
    const parsed = storeCollectionSlugQuerySchema.parse({ slug: '  summer  ', collectionId: 12 });

    // Assert
    expect(parsed).toEqual({ slug: 'summer', collectionId: '12' });
  });

  it('reads an empty collection id as none', () => {
    expect(storeCollectionSlugQuerySchema.parse({ slug: 'summer', collectionId: '' })).toEqual({ slug: 'summer' });
  });

  it('refuses a blank, over-long or unclean slug', () => {
    for (const slug of ['', '   ', 'x'.repeat(SLUG_MAX + 1), 'a\u0000b', '‮ab']) {
      expect(storeCollectionSlugQuerySchema.safeParse({ slug }).success).toBe(false);
    }
  });
});
