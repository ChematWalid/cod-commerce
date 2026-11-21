import { quantityConfigSchema } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { nextTier } from '../../../domain/kinds/quantity';
import { quantityNudge } from '../../../domain/kinds/quantity-nudge';
import { aKindInput, aRunningLine } from '../../support/kind-input';

const PERCENT_TIERS = quantityConfigSchema.parse({
  priceMode: 'percent',
  tiers: [
    { quantity: 2, price: 10 },
    { quantity: 3, price: 15, freeDelivery: true },
  ],
});

describe('quantityNudge', () => {
  it('nudges one piece toward the 2-piece tier with saving 980', () => {
    // Arrange
    const input = aKindInput(PERCENT_TIERS, [aRunningLine({ quantity: 1 })]);

    // Act
    const nudge = quantityNudge(input);

    // Assert
    expect(nudge).toEqual({ type: 'next_tier', offerId: '7001', units: 1, tierQuantity: 2, saving: 980 });
  });

  it('returns no nudge at the top tier', () => {
    // Arrange
    const input = aKindInput(PERCENT_TIERS, [aRunningLine({ quantity: 3 })]);

    // Act
    const nudge = quantityNudge(input);

    // Assert
    expect(nudge).toBeNull();
  });

  it('computes the 2-to-3 nudge as the total discount at tier 3', () => {
    // Arrange
    const input = aKindInput(PERCENT_TIERS, [aRunningLine({ quantity: 2 })]);

    // Act
    const nudge = quantityNudge(input);

    // Assert
    expect(nudge).toEqual({ type: 'next_tier', offerId: '7001', units: 1, tierQuantity: 3, saving: 2_205 });
  });

  it('returns no nudge when no line is targeted', () => {
    // Arrange
    const input = aKindInput(PERCENT_TIERS, [aRunningLine({ productId: '2' })]);

    // Act
    const nudge = quantityNudge(input);

    // Assert
    expect(nudge).toBeNull();
  });

  it('values the missing pieces at the smallest unit discount of the matched lines', () => {
    // Arrange
    const dear = aRunningLine({ variantId: '11', originalPrice: 4_900 });
    const cheap = aRunningLine({ variantId: '12', originalPrice: 3_000 });
    const input = aKindInput(PERCENT_TIERS, [dear, cheap]);

    // Act
    const nudge = quantityNudge(input);

    // Assert
    expect(nudge).toEqual({ type: 'next_tier', offerId: '7001', units: 1, tierQuantity: 3, saving: 735 + 450 + 450 });
  });

  it('finds the first tier above the pieces', () => {
    // Arrange
    const pieces = [0, 1, 2, 3];

    // Act
    const tiers = pieces.map((count) => nextTier(PERCENT_TIERS, count)?.quantity);

    // Assert
    expect(tiers).toEqual([2, 2, 3, undefined]);
  });
});
