import { describe, expect, it } from 'vitest';
import { packWeight } from '../../domain/pack-weight';
import { aDefinition } from '../support/builders';

describe('packWeight (D2202)', () => {
  it('sums 300 g × 2 + 500 g = 1 100', () => {
    // Arrange
    const summed = aDefinition();

    // Act
    const weight = packWeight(summed, [
      { weightGrams: 300, quantity: 2 },
      { weightGrams: 500, quantity: 1 },
    ]);

    // Assert
    expect(weight).toBe(1100);
  });

  it('counts a component without a weight as 0 g', () => {
    // Arrange
    const summed = aDefinition();

    // Act
    const weight = packWeight(summed, [
      { weightGrams: null, quantity: 3 },
      { weightGrams: 500, quantity: 1 },
    ]);

    // Assert
    expect(weight).toBe(500);
  });

  it('fixed returns the fixed grams', () => {
    // Arrange
    const fixed = aDefinition({ packWeightMode: 'fixed', packFixedWeightGrams: 750 });

    // Act
    const weight = packWeight(fixed, [{ weightGrams: 300, quantity: 2 }]);

    // Assert
    expect(weight).toBe(750);
  });
});
