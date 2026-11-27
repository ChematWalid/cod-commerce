import { MAX_PRODUCT_HIGHLIGHTS, PLATFORM_LANGUAGE_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { DEMO_COLLECTION_KEYS, demoCollectionsFor, demoProductsFor } from '../../domain/demo-products';

describe('demoProductsFor', () => {
  it.each(PLATFORM_LANGUAGE_CODES)('has ten products per language with unique skus (%s)', (language) => {
    // Act
    const products = demoProductsFor(language);

    // Assert
    expect(products).toHaveLength(10);
    expect(new Set(products.map((product) => product.sku)).size).toBe(10);
  });

  it.each(PLATFORM_LANGUAGE_CODES)(
    'lists eight active products on the storefront, each with an image (%s)',
    (language) => {
      // Act
      const active = demoProductsFor(language).filter((product) => product.status === 'active');

      // Assert
      expect(active).toHaveLength(8);
      expect(active.every((product) => /^#[0-9a-f]{6}$/.test(product.imageColor ?? ''))).toBe(true);
      expect(active.filter((product) => product.optionGroups.length > 0).length).toBeGreaterThanOrEqual(3);
    },
  );

  it('puts listed products in each demo collection', () => {
    // Act
    const active = demoProductsFor('ar').filter((product) => product.status === 'active');

    // Assert
    for (const key of DEMO_COLLECTION_KEYS) {
      expect(active.filter((product) => product.collectionKeys.includes(key)).length, key).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(PLATFORM_LANGUAGE_CODES)('covers active, hidden and draft (%s)', (language) => {
    // Act
    const statuses = new Set(demoProductsFor(language).map((product) => product.status));

    // Assert
    expect([...statuses].sort()).toEqual(['active', 'draft', 'hidden']);
  });

  it('holds one colour by size matrix, one branded product and one product with an old price', () => {
    // Act
    const products = demoProductsFor('en');

    // Assert
    const firstFive = products.slice(0, 5);
    const matrix = firstFive.filter((product) => product.optionGroups.length === 2);
    expect(matrix.map((product) => product.optionGroups.map((group) => group.values.length))).toEqual([[2, 2]]);
    const branded = firstFive.filter((product) => product.brandName !== null);
    expect(branded).toHaveLength(1);
    expect(branded[0]?.tagNames).toHaveLength(1);
    expect(branded[0]?.highlightTexts).toHaveLength(3);
    expect(firstFive.filter((product) => product.oldPrice !== null && product.oldPrice > product.price)).toHaveLength(
      1,
    );
    expect(products.filter((product) => product.brandName !== null)).toHaveLength(1);
  });

  it('writes the titles in the store language', () => {
    // Act
    const titles = PLATFORM_LANGUAGE_CODES.map((language) => demoProductsFor(language)[0]?.title);

    // Assert
    expect(new Set(titles).size).toBe(PLATFORM_LANGUAGE_CODES.length);
  });

  it('falls back to English for a language it does not know', () => {
    // Act and Assert
    expect(demoProductsFor('de')).toEqual(demoProductsFor('en'));
  });

  it('never names more highlights than a product may hold', () => {
    // Act
    const counts = PLATFORM_LANGUAGE_CODES.flatMap((language) =>
      demoProductsFor(language).map((product) => product.highlightTexts.length),
    );

    // Assert
    expect(Math.max(...counts)).toBeLessThanOrEqual(MAX_PRODUCT_HIGHLIGHTS);
  });

  it.each(PLATFORM_LANGUAGE_CODES)('names two collections with slugs of their own language (%s)', (language) => {
    // Act
    const collections = demoCollectionsFor(language);

    // Assert
    expect(collections.map((collection) => [collection.key, collection.position])).toEqual([
      ['apparel', 0],
      ['home', 1],
    ]);
    expect(collections.every((collection) => /^[a-z]+$/.test(collection.slug))).toBe(true);
  });

  it('never gives two languages the same collection slug, so two demo stores never share one', () => {
    // Act
    const slugs = PLATFORM_LANGUAGE_CODES.flatMap((language) => demoCollectionsFor(language).map(({ slug }) => slug));

    // Assert
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
