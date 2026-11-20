import { quantityConfigSchema, type QuantityConfig, type QuantityTier } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { LineOutcome, OfferOutcome } from '../../../domain/engine/outcome';
import { quantityCalculator, tierFor, unitPriceAtTier } from '../../../domain/kinds/quantity';
import { aKindInput, aRunningLine } from '../../support/kind-input';

/** 2 pieces −10 %, 3 pieces −15 % with free delivery: the brief's worked examples. */
const PERCENT_TIERS = quantityConfigSchema.parse({
  priceMode: 'percent',
  tiers: [
    { quantity: 2, price: 10 },
    { quantity: 3, price: 15, freeDelivery: true },
  ],
});

/** 2 pieces for 9,000 DZD in total. */
const TOTAL_TIERS = quantityConfigSchema.parse({ priceMode: 'total', tiers: [{ quantity: 2, price: 9_000 }] });

/** The first tier of `config`, failing the test when it has none. */
function firstTier(config: QuantityConfig): QuantityTier {
  const [tier] = config.tiers;
  if (tier === undefined) throw new Error('config has no tier');
  return tier;
}

/** `outcome` narrowed to a line outcome, failing the test otherwise. */
function asLine(outcome: OfferOutcome): LineOutcome {
  if (outcome.kind !== 'line') throw new Error(`expected a line outcome, got ${outcome.kind}`);
  return outcome;
}

describe('quantityCalculator', () => {
  it('prices two pieces at 10 percent off as 4410 each', () => {
    // Arrange
    const input = aKindInput(PERCENT_TIERS, [aRunningLine({ quantity: 2 })]);

    // Act
    const outcome = asLine(quantityCalculator.evaluate(input));

    // Assert
    expect(unitPriceAtTier(PERCENT_TIERS, firstTier(PERCENT_TIERS), 4_900)).toBe(4_410);
    expect(outcome.unitDiscounts.get('11')).toBe(490);
    expect(outcome.value).toBe(980);
    expect(outcome.freeDelivery).toBe(false);
  });

  it('skips one piece below the first tier as no_tier_reached', () => {
    // Arrange
    const input = aKindInput(PERCENT_TIERS, [aRunningLine({ quantity: 1 })]);

    // Act
    const outcome = quantityCalculator.evaluate(input);

    // Assert
    expect(outcome).toEqual({ kind: 'skip', reason: 'no_tier_reached' });
  });

  it('applies the highest reached tier to every matched piece', () => {
    // Arrange
    const input = aKindInput(PERCENT_TIERS, [aRunningLine({ quantity: 4 })]);

    // Act
    const outcome = asLine(quantityCalculator.evaluate(input));

    // Assert
    expect(outcome.unitDiscounts.get('11')).toBe(735);
    expect(outcome.value).toBe(4 * 735);
  });

  it('counts pieces across variants of the target product', () => {
    // Arrange
    const red = aRunningLine({ variantId: '11', productId: '1' });
    const blue = aRunningLine({ variantId: '12', productId: '1' });
    const mug = aRunningLine({ variantId: '21', productId: '2', quantity: 5 });
    const input = aKindInput(PERCENT_TIERS, [red, blue, mug]);

    // Act
    const outcome = asLine(quantityCalculator.evaluate(input));

    // Assert
    expect([...outcome.unitDiscounts]).toEqual([
      ['11', 490],
      ['12', 490],
    ]);
    expect(outcome.value).toBe(980);
  });

  it('prices total mode at the rounded unit of the tier total', () => {
    // Arrange
    const input = aKindInput(TOTAL_TIERS, [aRunningLine({ quantity: 2 })]);

    // Act
    const outcome = asLine(quantityCalculator.evaluate(input));

    // Assert
    expect(outcome.unitDiscounts.get('11')).toBe(400);
    expect(outcome.value).toBe(800);
  });

  it('never raises a unit above its original price in total mode', () => {
    // Arrange
    const cheap = aRunningLine({ quantity: 2, originalPrice: 3_000 });
    const input = aKindInput(TOTAL_TIERS, [cheap]);

    // Act
    const outcome = asLine(quantityCalculator.evaluate(input));

    // Assert
    expect(outcome.unitDiscounts.get('11')).toBe(0);
    expect(unitPriceAtTier(TOTAL_TIERS, firstTier(TOTAL_TIERS), 3_000)).toBe(3_000);
  });

  it('marks free delivery on a tier that has it', () => {
    // Arrange
    const input = aKindInput(PERCENT_TIERS, [aRunningLine({ quantity: 3 })], {
      delivery: { resolved: true, baseFee: 800, overweightFee: 200, speed: null, method: 'home' },
    });

    // Act
    const outcome = asLine(quantityCalculator.evaluate(input));

    // Assert
    expect(outcome.freeDelivery).toBe(true);
    expect(outcome.value).toBe(3 * 735 + 800 + 200);
  });

  it('gives no effect when no line is targeted', () => {
    // Arrange
    const input = aKindInput(PERCENT_TIERS, [aRunningLine({ productId: '2', quantity: 3 })]);

    // Act
    const outcome = asLine(quantityCalculator.evaluate(input));

    // Assert
    expect(outcome.unitDiscounts.size).toBe(0);
    expect(outcome.value).toBe(0);
  });

  it('finds the highest tier at or below the pieces', () => {
    // Arrange
    const pieces = [1, 2, 3, 9];

    // Act
    const tiers = pieces.map((count) => tierFor(PERCENT_TIERS, count)?.quantity);

    // Assert
    expect(tiers).toEqual([undefined, 2, 3, 3]);
  });

  it('is a product-class calculator at the quantity stage', () => {
    // Arrange
    const calculator = quantityCalculator;

    // Act
    const identity = [calculator.kind, calculator.combinationClass, calculator.stage];

    // Assert
    expect(identity).toEqual(['quantity', 'product', 10]);
  });
});
