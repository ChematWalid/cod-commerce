import { describe, expect, it } from 'vitest';
import { giftUnits } from '../../../domain/kinds/gift-units';
import { aRunningLine } from '../../support/kind-input';

describe('giftUnits', () => {
  it('takes the cheapest units first', () => {
    // Arrange
    const dear = aRunningLine({ variantId: '11', quantity: 2, unitPrice: 4_900 });
    const cheap = aRunningLine({ variantId: '12', quantity: 1, unitPrice: 3_900 });

    // Act
    const gifts = giftUnits({ lines: [dear, cheap], units: 1 });

    // Assert
    expect([...gifts]).toEqual([['12', 1]]);
  });

  it('breaks a price tie by variant id ascending, numerically', () => {
    // Arrange
    const later = aRunningLine({ variantId: '100', quantity: 1 });
    const earlier = aRunningLine({ variantId: '99', quantity: 1 });

    // Act
    const gifts = giftUnits({ lines: [later, earlier], units: 1 });

    // Assert
    expect([...gifts]).toEqual([['99', 1]]);
  });

  it('spreads the units over the next cheapest lines', () => {
    // Arrange
    const dear = aRunningLine({ variantId: '11', quantity: 3, unitPrice: 4_900 });
    const cheap = aRunningLine({ variantId: '12', quantity: 1, unitPrice: 3_900 });

    // Act
    const gifts = giftUnits({ lines: [dear, cheap], units: 3 });

    // Assert
    expect([...gifts]).toEqual([
      ['12', 1],
      ['11', 2],
    ]);
  });

  it('never gifts more units than the lines hold', () => {
    // Arrange
    const only = aRunningLine({ variantId: '11', quantity: 2 });

    // Act
    const gifts = giftUnits({ lines: [only], units: 5 });

    // Assert
    expect([...gifts]).toEqual([['11', 2]]);
  });

  it('gifts nothing for zero units', () => {
    // Arrange
    const only = aRunningLine({ variantId: '11', quantity: 2 });

    // Act
    const gifts = giftUnits({ lines: [only], units: 0 });

    // Assert
    expect(gifts.size).toBe(0);
  });
});
