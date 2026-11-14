import { CATALOG_WARNING_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { priceWarningsOf } from '../../domain/price-warnings';

describe('priceWarningsOf', () => {
  it('warns when old price is below price, naming the row', () => {
    // Act
    const warnings = priceWarningsOf([
      { price: 2000, oldPrice: 2500 },
      { price: 3000, oldPrice: 2500 },
    ]);

    // Assert
    expect(warnings).toEqual([{ code: CATALOG_WARNING_CODES.oldPriceBelowPrice, index: 1 }]);
  });

  it('does not warn without old price', () => {
    // Act
    const warnings = priceWarningsOf([{ price: 3000, oldPrice: null }]);

    // Assert
    expect(warnings).toEqual([]);
  });

  it('does not warn when the old price equals the price', () => {
    // Act
    const warnings = priceWarningsOf([{ price: 3000, oldPrice: 3000 }]);

    // Assert
    expect(warnings).toEqual([]);
  });
});
