import { SKU_MAX } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidCatalogInputError } from '../../domain/errors';
import { skuSequence, variantName } from '../../domain/sku';

describe('skuSequence', () => {
  it('numbers skus from <sku>-1 in order', () => {
    // Act
    const skus = skuSequence('TS', new Set(), 4);

    // Assert
    expect(skus).toEqual(['TS-1', 'TS-2', 'TS-3', 'TS-4']);
  });

  it('skips skus a live variant already holds', () => {
    // Act
    const skus = skuSequence('TS', new Set(['TS-1', 'TS-3']), 3);

    // Assert
    expect(skus).toEqual(['TS-2', 'TS-4', 'TS-5']);
  });

  it('gives empty skus when the product has none', () => {
    // Act
    const skus = skuSequence(null, new Set(['TS-1']), 2);

    // Assert
    expect(skus).toEqual(['', '']);
  });

  it('accepts a sku of exactly SKU_MAX characters', () => {
    // Arrange
    const baseSku = 'S'.repeat(SKU_MAX - 2);

    // Act
    const skus = skuSequence(baseSku, new Set(), 1);

    // Assert
    expect(skus).toEqual([`${baseSku}-1`]);
  });

  it('refuses when a generated sku would be longer than SKU_MAX', () => {
    // Arrange: `-10` makes the tenth sku one character too long.
    const baseSku = 'S'.repeat(SKU_MAX - 2);

    // Act
    const skus = (): unknown => skuSequence(baseSku, new Set(), 10);

    // Assert
    expect(skus).toThrow(InvalidCatalogInputError);
  });

  it('gives nothing for a count of zero', () => {
    // Act
    const skus = skuSequence('TS', new Set(), 0);

    // Assert
    expect(skus).toEqual([]);
  });
});

describe('variantName', () => {
  it('joins the product name and the option values', () => {
    // Act
    const name = variantName('Product', ['Red', 'S']);

    // Assert
    expect(name).toBe('Product - Red / S');
  });

  it('is the product name alone without option values', () => {
    // Act
    const name = variantName('حذاء رياضي', []);

    // Assert
    expect(name).toBe('حذاء رياضي');
  });
});
