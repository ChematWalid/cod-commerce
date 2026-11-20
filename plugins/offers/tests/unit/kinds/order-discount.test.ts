import { orderDiscountConfigSchema } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { OfferOutcome, OrderOutcome } from '../../../domain/engine/outcome';
import { orderDiscountCalculator } from '../../../domain/kinds/order-discount';
import { aKindInput, aRunningLine } from '../../support/kind-input';

/** An order discount config parsed like a stored one: 10 % with no minimum by default. */
const config = (raw: Record<string, unknown>) =>
  orderDiscountConfigSchema.parse({ valueType: 'percent', value: 10, ...raw });

/** `outcome` narrowed to an order outcome, failing the test otherwise. */
function asOrder(outcome: OfferOutcome): OrderOutcome {
  if (outcome.kind !== 'order') throw new Error(`expected an order outcome, got ${outcome.kind}`);
  return outcome;
}

/** Two shirts at 4,900: subtotal 9,800, 2 pieces. */
const twoShirts = [aRunningLine({ variantId: '11', productId: '1', quantity: 2 })];

describe('orderDiscountCalculator', () => {
  it('takes 10 percent off a 9800 subtotal as 980', () => {
    // Arrange
    const input = aKindInput(config({}), twoShirts);

    // Act
    const outcome = asOrder(orderDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome).toEqual({ kind: 'order', amount: 980, value: 980 });
  });

  it('rounds a percent order discount half up', () => {
    // Arrange
    const input = aKindInput(config({ value: 15 }), [aRunningLine({ originalPrice: 4_950 })]);

    // Act
    const outcome = asOrder(orderDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.amount).toBe(743);
  });

  it('caps an order discount', () => {
    // Arrange
    const input = aKindInput(config({ cap: 500 }), twoShirts);

    // Act
    const outcome = asOrder(orderDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.amount).toBe(500);
    expect(outcome.value).toBe(500);
  });

  it('takes a fixed amount off the order', () => {
    // Arrange
    const input = aKindInput(config({ valueType: 'fixed', value: 1_000 }), twoShirts);

    // Act
    const outcome = asOrder(orderDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.amount).toBe(1_000);
  });

  it('never discounts more than the subtotal', () => {
    // Arrange
    const input = aKindInput(config({ valueType: 'fixed', value: 20_000 }), twoShirts);

    // Act
    const outcome = asOrder(orderDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.amount).toBe(9_800);
    expect(outcome.value).toBe(9_800);
  });

  it('measures the percent on the subtotal after line offers', () => {
    // Arrange
    const tiered = [aRunningLine({ quantity: 2, unitPrice: 4_410 })];
    const input = aKindInput(config({}), tiered);

    // Act
    const outcome = asOrder(orderDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.amount).toBe(882);
  });

  it('skips an amount minimum not met as min_not_met', () => {
    // Arrange
    const input = aKindInput(config({ minimum: { type: 'amount', min: 10_000 } }), twoShirts);

    // Act
    const outcome = orderDiscountCalculator.evaluate(input);

    // Assert
    expect(outcome).toEqual({ kind: 'skip', reason: 'min_not_met' });
  });

  it('applies when the amount minimum is reached exactly', () => {
    // Arrange
    const input = aKindInput(config({ minimum: { type: 'amount', min: 9_800 } }), twoShirts);

    // Act
    const outcome = asOrder(orderDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.amount).toBe(980);
  });

  it('skips a pieces minimum not met', () => {
    // Arrange
    const input = aKindInput(config({ minimum: { type: 'pieces', min: 3 } }), twoShirts);

    // Act
    const outcome = orderDiscountCalculator.evaluate(input);

    // Assert
    expect(outcome).toEqual({ kind: 'skip', reason: 'min_not_met' });
  });

  it('applies with minimum none', () => {
    // Arrange
    const input = aKindInput(config({ minimum: { type: 'none' } }), twoShirts);

    // Act
    const outcome = asOrder(orderDiscountCalculator.evaluate(input));

    // Assert
    expect(outcome.amount).toBe(980);
  });

  it('is an order-class calculator at the order stage', () => {
    // Arrange
    const calculator = orderDiscountCalculator;

    // Act
    const identity = [calculator.kind, calculator.combinationClass, calculator.stage];

    // Assert
    expect(identity).toEqual(['order_discount', 'order', 30]);
  });
});
