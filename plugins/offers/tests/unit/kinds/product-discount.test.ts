import { productDiscountConfigSchema } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { LineOutcome, OfferOutcome } from '../../../domain/engine/outcome';
import { productDiscountCalculator } from '../../../domain/kinds/product-discount';
import { aKindInput, aRunningLine } from '../../support/kind-input';

/** A product discount config parsed like a stored one. */
const config = (raw: Record<string, unknown>) =>
  productDiscountConfigSchema.parse({ appliesTo: 'targets', valueType: 'percent', value: 20, ...raw });

/** `outcome` narrowed to a line outcome, failing the test otherwise. */
function asLine(outcome: OfferOutcome): LineOutcome {
  if (outcome.kind !== 'line') throw new Error(`expected a line outcome, got ${outcome.kind}`);
  return outcome;
}

const shirt = aRunningLine({ variantId: '11', productId: '1', quantity: 2 });
const mug = aRunningLine({ variantId: '21', productId: '2', originalPrice: 1_500 });

describe('productDiscountCalculator', () => {
  it('takes 20 percent off every unit of a targeted product', () => {
    // Arrange
    const input = aKindInput(config({}), [shirt]);

    // Act
    const outcome = asLine(productDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.unitDiscounts.get('11')).toBe(980);
    expect(outcome.value).toBe(1_960);
    expect(outcome.freeDelivery).toBe(false);
  });

  it('takes a fixed 500 off each unit', () => {
    // Arrange
    const input = aKindInput(config({ valueType: 'fixed', value: 500 }), [shirt]);

    // Act
    const outcome = asLine(productDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.unitDiscounts.get('11')).toBe(500);
    expect(outcome.value).toBe(1_000);
  });

  it('clamps a fixed discount at the unit price', () => {
    // Arrange
    const input = aKindInput(config({ valueType: 'fixed', value: 6_000 }), [shirt]);

    // Act
    const outcome = asLine(productDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.unitDiscounts.get('11')).toBe(4_900);
    expect(outcome.value).toBe(9_800);
  });

  it('caps a percent discount per unit', () => {
    // Arrange
    const input = aKindInput(config({ cap: 700 }), [shirt]);

    // Act
    const outcome = asLine(productDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.unitDiscounts.get('11')).toBe(700);
    expect(outcome.value).toBe(1_400);
  });

  it('rounds a percent discount half up per unit', () => {
    // Arrange
    const odd = aRunningLine({ originalPrice: 4_950 });
    const input = aKindInput(config({ value: 15 }), [odd]);

    // Act
    const outcome = asLine(productDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.unitDiscounts.get('11')).toBe(743);
  });

  it('applies to every line when appliesTo is all', () => {
    // Arrange
    const input = aKindInput(config({ appliesTo: 'all' }), [shirt, mug]);

    // Act
    const outcome = asLine(productDiscountCalculator.evaluate(input));

    // Assert
    expect([...outcome.unitDiscounts]).toEqual([
      ['11', 980],
      ['21', 300],
    ]);
    expect(outcome.value).toBe(1_960 + 300);
  });

  it('leaves untargeted lines untouched', () => {
    // Arrange
    const input = aKindInput(config({}), [shirt, mug]);

    // Act
    const outcome = asLine(productDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.unitDiscounts.has('21')).toBe(false);
    expect(outcome.value).toBe(1_960);
  });

  it('discounts the running unit price left by an earlier line offer', () => {
    // Arrange
    const tiered = aRunningLine({ quantity: 2, unitPrice: 4_410 });
    const input = aKindInput(config({ value: 10 }), [tiered]);

    // Act
    const outcome = asLine(productDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.unitDiscounts.get('11')).toBe(441);
  });

  it('is a product-class calculator at the product-discount stage', () => {
    // Arrange
    const calculator = productDiscountCalculator;

    // Act
    const identity = [calculator.kind, calculator.combinationClass, calculator.stage];

    // Assert
    expect(identity).toEqual(['product_discount', 'product', 20]);
  });
});
