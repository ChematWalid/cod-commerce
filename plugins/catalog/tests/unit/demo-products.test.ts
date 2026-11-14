import { MAX_PRODUCT_HIGHLIGHTS, PLATFORM_LANGUAGE_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { demoProductsFor } from '../../domain/demo-products';

describe('demoProductsFor', () => {
  it.each(PLATFORM_LANGUAGE_CODES)('has five products per language with unique skus (%s)', (language) => {
    // Act
    const products = demoProductsFor(language);

    // Assert
    expect(products).toHaveLength(5);
    expect(new Set(products.map((product) => product.sku)).size).toBe(5);
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
    const matrix = products.filter((product) => product.optionGroups.length === 2);
    expect(matrix.map((product) => product.optionGroups.map((group) => group.values.length))).toEqual([[2, 2]]);
    const branded = products.filter((product) => product.brandName !== null);
    expect(branded).toHaveLength(1);
    expect(branded[0]?.tagNames).toHaveLength(1);
    expect(branded[0]?.highlightTexts).toHaveLength(3);
    expect(products.filter((product) => product.oldPrice !== null && product.oldPrice > product.price)).toHaveLength(1);
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
});
