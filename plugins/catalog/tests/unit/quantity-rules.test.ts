import { QUANTITY_RULE_MAX } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidCatalogInputError } from '../../domain/errors';
import { allowsQuantity, QuantityRules } from '../../domain/quantity-rules';

describe('QuantityRules', () => {
  it('accepts quantities min, min+step', () => {
    // Arrange
    const rules = QuantityRules.create({ enabled: true, min: 3, step: 2 });

    // Act
    const allowed = [3, 5, 7].map((quantity) => allowsQuantity(rules, quantity));

    // Assert
    expect(allowed).toEqual([true, true, true]);
  });

  it('refuses a quantity between steps', () => {
    // Arrange
    const rules = QuantityRules.create({ enabled: true, min: 3, step: 2 });

    // Act
    const allowed = allowsQuantity(rules, 4);

    // Assert
    expect(allowed).toBe(false);
  });

  it('refuses a quantity below the minimum', () => {
    // Arrange
    const rules = QuantityRules.create({ enabled: true, min: 3, step: 1 });

    // Act
    const allowed = allowsQuantity(rules, 2);

    // Assert
    expect(allowed).toBe(false);
  });

  it('accepts any whole quantity from one when the rules are off', () => {
    // Arrange
    const rules = QuantityRules.create({ enabled: false, min: 5, step: 5 });

    // Act
    const allowed = [1, 2, 7].map((quantity) => allowsQuantity(rules, quantity));

    // Assert
    expect(allowed).toEqual([true, true, true]);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses the quantity %s whatever the rules',
    (quantity) => {
      // Arrange
      const rules = QuantityRules.create({ enabled: false, min: 1, step: 1 });

      // Act
      const allowed = allowsQuantity(rules, quantity);

      // Assert
      expect(allowed).toBe(false);
    },
  );

  it.each([
    ['a minimum of 0', { min: 0, step: 1 }],
    ['a step of 0', { min: 1, step: 0 }],
    ['a fractional step', { min: 1, step: 1.5 }],
    ['a minimum above the cap', { min: QUANTITY_RULE_MAX + 1, step: 1 }],
  ])('refuses %s', (_label, bounds) => {
    // Act
    const create = (): QuantityRules => QuantityRules.create({ enabled: true, ...bounds });

    // Assert
    expect(create).toThrow(InvalidCatalogInputError);
  });
});
