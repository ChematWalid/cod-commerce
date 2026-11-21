import { freeDeliveryConfigSchema } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { DeliveryContext } from '../../../domain/engine/outcome';
import { freeDeliveryCalculator } from '../../../domain/kinds/free-delivery';
import { aKindInput, aRunningLine } from '../../support/kind-input';

/** A free-delivery config parsed like a stored one: no threshold by default. */
const config = (raw: Record<string, unknown> = {}) => freeDeliveryConfigSchema.parse(raw);

/** A resolved home delivery at 800 DZD with no overweight fee. */
const HOME_800: DeliveryContext = { resolved: true, baseFee: 800, overweightFee: 0, speed: null, method: 'home' };

/** `count` pieces of one shirt at 4,900. */
const shirts = (count: number) => [aRunningLine({ variantId: '11', productId: '1', quantity: count })];

/** The suggestion `freeDeliveryCalculator` gives, failing the test when the kind has no `suggest`. */
function suggestionFor(input: ReturnType<typeof aKindInput<ReturnType<typeof config>>>) {
  if (freeDeliveryCalculator.suggest === undefined) throw new Error('free delivery must suggest');
  return freeDeliveryCalculator.suggest(input);
}

describe('freeDeliveryCalculator', () => {
  it('waives the 800 home fee with no threshold', () => {
    // Arrange
    const input = aKindInput(config(), shirts(1), { delivery: HOME_800 });

    // Act
    const outcome = freeDeliveryCalculator.evaluate(input);

    // Assert
    expect(outcome).toEqual({ kind: 'delivery', value: 800 });
  });

  it('waives from 3 pieces', () => {
    // Arrange
    const input = aKindInput(config({ threshold: { type: 'pieces', min: 3 } }), shirts(3), { delivery: HOME_800 });

    // Act
    const outcome = freeDeliveryCalculator.evaluate(input);

    // Assert
    expect(outcome).toEqual({ kind: 'delivery', value: 800 });
  });

  it('skips at 2 pieces with min_not_met and suggests one more piece', () => {
    // Arrange
    const input = aKindInput(config({ threshold: { type: 'pieces', min: 3 } }), shirts(2), { delivery: HOME_800 });

    // Act
    const outcome = freeDeliveryCalculator.evaluate(input);
    const suggestion = suggestionFor(input);

    // Assert
    expect(outcome).toEqual({ kind: 'skip', reason: 'min_not_met' });
    expect(suggestion).toEqual({ type: 'free_delivery', offerId: input.offer.id, missing: { pieces: 1 } });
  });

  it('suggests the missing amount below an amount threshold', () => {
    // Arrange
    const threshold = { type: 'amount', min: 12_000 };
    const input = aKindInput(config({ threshold }), shirts(2), { delivery: HOME_800 });

    // Act
    const outcome = freeDeliveryCalculator.evaluate(input);
    const suggestion = suggestionFor(input);

    // Assert
    expect(outcome).toEqual({ kind: 'skip', reason: 'min_not_met' });
    expect(suggestion).toEqual({ type: 'free_delivery', offerId: input.offer.id, missing: { amount: 2_200 } });
  });

  it('suggests nothing once the threshold is met', () => {
    // Arrange
    const input = aKindInput(config({ threshold: { type: 'pieces', min: 3 } }), shirts(3), { delivery: HOME_800 });

    // Act
    const suggestion = suggestionFor(input);

    // Assert
    expect(suggestion).toBeNull();
  });

  it('suggests nothing without a threshold', () => {
    // Arrange
    const input = aKindInput(config(), shirts(1), { delivery: HOME_800 });

    // Act
    const suggestion = suggestionFor(input);

    // Assert
    expect(suggestion).toBeNull();
  });

  it('values the waiver at the base fee plus the overweight fee', () => {
    // Arrange
    const heavy: DeliveryContext = { ...HOME_800, overweightFee: 200 };
    const input = aKindInput(config(), shirts(1), { delivery: heavy });

    // Act
    const outcome = freeDeliveryCalculator.evaluate(input);

    // Assert
    expect(outcome).toEqual({ kind: 'delivery', value: 1_000 });
  });

  it('waives nothing when the delivery is unresolved', () => {
    // Arrange
    const input = aKindInput(config(), shirts(1));

    // Act
    const outcome = freeDeliveryCalculator.evaluate(input);

    // Assert
    expect(outcome).toEqual({ kind: 'delivery', value: 0 });
  });

  it('is a delivery-class calculator at the delivery stage', () => {
    // Arrange
    const calculator = freeDeliveryCalculator;

    // Act
    const identity = [calculator.kind, calculator.combinationClass, calculator.stage];

    // Assert
    expect(identity).toEqual(['free_delivery', 'delivery', 40]);
  });
});
