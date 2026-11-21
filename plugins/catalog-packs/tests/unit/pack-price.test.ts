import { describe, expect, it } from 'vitest';
import { packPrice } from '../../domain/pack-price';
import { aDefinition } from '../support/builders';

const summed = aDefinition();

describe('packPrice (D2202)', () => {
  it('two components 1 500 and 2 000 DZD with 10 % discount cost 3 150', () => {
    // Arrange
    const components = [
      { unitPrice: 1500, quantity: 1 },
      { unitPrice: 2000, quantity: 1 },
    ];

    // Act
    const price = packPrice(summed, components);

    // Assert
    expect(price).toBe(3150);
  });

  it('rounds 3 333.5 half-up to 3 334', () => {
    // Arrange: 6 667 at 50 % is 3 333.5
    const half = aDefinition({ packDiscountValue: 50 });

    // Act
    const price = packPrice(half, [
      { unitPrice: 6000, quantity: 1 },
      { unitPrice: 667, quantity: 1 },
    ]);

    // Assert
    expect(price).toBe(3334);
  });

  it('amount discount larger than the sum clamps to 0', () => {
    // Arrange
    const amount = aDefinition({ packDiscountType: 'amount', packDiscountValue: 5000 });

    // Act
    const price = packPrice(amount, [
      { unitPrice: 1500, quantity: 1 },
      { unitPrice: 2000, quantity: 1 },
    ]);

    // Assert
    expect(price).toBe(0);
  });

  it('quantity 2 counts twice', () => {
    // Arrange
    const noDiscount = aDefinition({ packDiscountType: null, packDiscountValue: null });

    // Act
    const price = packPrice(noDiscount, [
      { unitPrice: 1500, quantity: 2 },
      { unitPrice: 2000, quantity: 1 },
    ]);

    // Assert
    expect(price).toBe(5000);
  });

  it('fixed mode returns the fixed price', () => {
    // Arrange
    const fixed = aDefinition({
      packPricingMode: 'fixed',
      packFixedPrice: 2500,
      packDiscountType: null,
      packDiscountValue: null,
    });

    // Act
    const price = packPrice(fixed, [
      { unitPrice: 1500, quantity: 1 },
      { unitPrice: 2000, quantity: 1 },
    ]);

    // Assert
    expect(price).toBe(2500);
  });
});
