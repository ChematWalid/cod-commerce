import { describe, expect, it } from 'vitest';
import { InvalidCatalogInputError } from '../../domain/errors';
import { singleLineText } from '../../domain/single-line-text';
import { skuSequence } from '../../domain/sku';
import { type MatrixInput, planVariantMatrix } from '../../domain/variant-matrix';

const LONE_HIGH_SURROGATE = String.fromCharCode(0xd800);
const LONE_LOW_SURROGATE = String.fromCharCode(0xdc00);

function input(overrides: Partial<MatrixInput> = {}): MatrixInput {
  return { productName: 'Product', baseSku: 'TS', basePrice: 2500, groups: [], existing: [], ...overrides };
}

describe('default variant sku', () => {
  it('gives the default variant the next free sku when a live variant removed in the same save holds the product sku', () => {
    // Arrange: the merchant removes every option; a variant of the old matrix was renamed to the product sku
    const existing = [
      { id: '11', optionValues: ['Red'], sku: 'TS' },
      { id: '12', optionValues: ['Blue'], sku: 'TS-1' },
    ];

    // Act
    const plan = planVariantMatrix(input({ existing }));

    // Assert
    expect(plan.remove).toEqual(['11', '12']);
    expect(plan.create).toEqual([{ name: 'Product', sku: 'TS-2', price: 2500, optionValues: [] }]);
  });

  it('compares the product sku with live skus without case or Unicode form', () => {
    // Arrange
    const existing = [{ id: '11', optionValues: ['Red'], sku: 'café' }];

    // Act
    const plan = planVariantMatrix(input({ baseSku: 'CAFÉ', existing }));

    // Assert
    expect(plan.create.map((variant) => variant.sku)).toEqual(['CAFÉ-1']);
  });

  it('keeps the product sku on the default variant when no live variant holds it', () => {
    // Arrange
    const existing = [{ id: '11', optionValues: ['Red'], sku: 'TS-1' }];

    // Act
    const plan = planVariantMatrix(input({ existing }));

    // Assert
    expect(plan.create.map((variant) => variant.sku)).toEqual(['TS']);
  });
});

describe('skuSequence matching', () => {
  it('skips a live sku that differs only by case or Unicode form', () => {
    // Act
    const skus = skuSequence('TS', new Set(['ts-1', 'Ts-3']), 2);

    // Assert
    expect(skus).toEqual(['TS-2', 'TS-4']);
  });
});

describe('singleLineText surrogates', () => {
  it.each([
    ['a lone high surrogate', `a${LONE_HIGH_SURROGATE}b`],
    ['a lone low surrogate', `a${LONE_LOW_SURROGATE}b`],
  ])('refuses %s, which UTF-8 turns into U+FFFD', (_name, value) => {
    // Act
    const read = () => singleLineText(value, 50);

    // Assert
    expect(read).toThrow(InvalidCatalogInputError);
  });

  it('accepts a whole surrogate pair such as an emoji', () => {
    // Act
    const value = singleLineText('Shoe 👟', 50);

    // Assert
    expect(value).toBe('Shoe 👟');
  });
});
