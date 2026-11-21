import { MAX_LINE_QUANTITY, MAX_TIERS, type QuantityConfig } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { addTier, canAddTier, changeTier, preselectTier, removeTier } from '../../dashboard/model/quantity-tiers';

const tier = (quantity: number, price: number, preselected = false) => ({
  quantity,
  price,
  preselected,
  freeDelivery: false,
});

const TWO_TIERS: QuantityConfig = { priceMode: 'percent', tiers: [tier(2, 10), tier(3, 15)] };

describe('quantity tiers', () => {
  it('adds a tier above the last one and keeps quantities ascending', () => {
    // Act
    const added = addTier(TWO_TIERS);

    // Assert
    expect(added.tiers.map((each) => each.quantity)).toEqual([2, 3, 4]);
    expect(added.tiers[2]).toEqual({ quantity: 4, price: 15, preselected: false, freeDelivery: false });
    expect(TWO_TIERS.tiers).toHaveLength(2);
  });

  it('adds no tier past the most tiers or the most pieces of a line', () => {
    // Arrange
    const full: QuantityConfig = {
      priceMode: 'percent',
      tiers: Array.from({ length: MAX_TIERS }, (_, index) => tier(index + 1, 5)),
    };
    const topped: QuantityConfig = { priceMode: 'total', tiers: [tier(MAX_LINE_QUANTITY, 900)] };

    // Act and Assert
    expect(canAddTier(full)).toBe(false);
    expect(addTier(full)).toBe(full);
    expect(canAddTier(topped)).toBe(false);
    expect(addTier(topped)).toBe(topped);
  });

  it('selects one preselected tier only', () => {
    // Arrange
    const first = preselectTier(TWO_TIERS, 0);

    // Act
    const second = preselectTier(first, 1);
    const cleared = preselectTier(second, 1);

    // Assert
    expect(first.tiers.map((each) => each.preselected)).toEqual([true, false]);
    expect(second.tiers.map((each) => each.preselected)).toEqual([false, true]);
    expect(cleared.tiers.map((each) => each.preselected)).toEqual([false, false]);
  });

  it('removes a tier but keeps the last one', () => {
    // Act
    const one = removeTier(TWO_TIERS, 0);

    // Assert
    expect(one.tiers.map((each) => each.quantity)).toEqual([3]);
    expect(removeTier(one, 0)).toBe(one);
  });

  it('changes one field of one tier', () => {
    // Act
    const changed = changeTier(TWO_TIERS, 1, { price: 20, freeDelivery: true });

    // Assert
    expect(changed.tiers[1]).toEqual({ quantity: 3, price: 20, preselected: false, freeDelivery: true });
    expect(changed.tiers[0]).toBe(TWO_TIERS.tiers[0]);
  });
});
