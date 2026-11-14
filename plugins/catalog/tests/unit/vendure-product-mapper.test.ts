import { LanguageCode, type Product, type ProductVariant } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { productRecordOf } from '../../infrastructure/vendure-product-mapper';

const LANGUAGE = LanguageCode.ar;

function productWith(fields: { optionGroups?: unknown[]; oldPrice?: number }): Product {
  return {
    id: 7,
    name: 'Shirt',
    slug: 'shirt',
    description: '',
    translations: [],
    assets: [],
    optionGroups: fields.optionGroups ?? [],
    customFields: { status: 'active', oldPrice: fields.oldPrice ?? null, defaultPrice: 2500, defaultSku: 'TS' },
  } as unknown as Product;
}

function variantWith(customFields: Record<string, unknown>): ProductVariant {
  return {
    id: 11,
    name: 'Shirt',
    sku: 'TS',
    price: 2500,
    translations: [],
    options: [],
    customFields: { isHidden: false, barcode: null, ...customFields },
  } as unknown as ProductVariant;
}

describe('productRecordOf', () => {
  it("reads a product without options' old price from its default variant, like its price and sku", () => {
    // Arrange: the variant's old price was edited through a variant patch; the product field was not.
    const product = productWith({});

    // Act
    const record = productRecordOf(product, [variantWith({ oldPrice: 5000 })], LANGUAGE);

    // Assert
    expect(record.oldPrice).toBe(5000);
    expect(record.variants[0]?.oldPrice).toBe(5000);
  });

  it("reads a product with options' old price from the product", () => {
    // Arrange
    const product = productWith({
      optionGroups: [{ id: 2, name: 'Size', translations: [], options: [] }],
      oldPrice: 3000,
    });

    // Act
    const record = productRecordOf(product, [variantWith({ oldPrice: 5000 })], LANGUAGE);

    // Assert
    expect(record.oldPrice).toBe(3000);
  });
});
