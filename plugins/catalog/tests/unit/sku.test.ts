import { describe, expect, it } from 'vitest';
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
