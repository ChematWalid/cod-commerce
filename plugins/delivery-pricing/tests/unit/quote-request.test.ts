import { describe, expect, it } from 'vitest';
import { parcelWeightOf, productsWithoutWeight } from '../../domain/quote-request';

describe('productsWithoutWeight', () => {
  it('names each product whose line sends no unit weight, once', () => {
    // Arrange
    const items = [
      { productId: '7', quantity: 1 },
      { productId: '7', quantity: 2 },
      { productId: '8', quantity: 1, weightGrams: 300 },
      { productId: '9', quantity: 1 },
    ];

    // Act and Assert
    expect(productsWithoutWeight(items)).toEqual(['7', '9']);
  });
});

describe('parcelWeightOf', () => {
  it('adds unit weight × quantity, the sent weight before the product weight', () => {
    // Arrange
    const items = [
      { productId: '7', quantity: 2 },
      { productId: '8', quantity: 3, weightGrams: 300 },
    ];
    const weights = new Map([
      ['7', 1200],
      ['8', 5000],
    ]);

    // Act and Assert
    expect(parcelWeightOf(items, weights)).toBe(2 * 1200 + 3 * 300);
  });

  it('counts a null or unknown product weight as 0 g (D3119)', () => {
    // Arrange
    const items = [
      { productId: '7', quantity: 2 },
      { productId: '9', quantity: 4 },
    ];

    // Act and Assert
    expect(parcelWeightOf(items, new Map([['7', null]]))).toBe(0);
  });

  it('weighs an empty parcel at 0 g', () => {
    expect(parcelWeightOf([], new Map())).toBe(0);
  });

  it.each([
    ['a zero quantity', { productId: '7', quantity: 0 }],
    ['a fractional quantity', { productId: '7', quantity: 1.5 }],
    ['a negative unit weight', { productId: '7', quantity: 1, weightGrams: -1 }],
    ['a fractional unit weight', { productId: '7', quantity: 1, weightGrams: 2.5 }],
  ])('answers no weight (NaN) for %s, which the quote reads as unresolved', (_label, item) => {
    expect(parcelWeightOf([item], new Map())).toBeNaN();
  });

  it('lets a huge quantity grow past the safe range, which the quote reads as unresolved', () => {
    // Arrange
    const items = [{ productId: '7', quantity: Number.MAX_SAFE_INTEGER, weightGrams: 1000 }];

    // Act and Assert
    expect(Number.isSafeInteger(parcelWeightOf(items, new Map()))).toBe(false);
  });
});
