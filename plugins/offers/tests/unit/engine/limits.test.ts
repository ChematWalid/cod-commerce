import { describe, expect, it } from 'vitest';
import { checkUsageLimits } from '../../../domain/engine/limits';
import { A_BUYER, aCart, anOffer, aSnapshot } from '../../support/builders';

describe('checkUsageLimits', () => {
  it('skips an offer whose total usage reached its limit', () => {
    // Arrange
    const offer = anOffer({ totalUsageLimit: 100, usageCount: 100 });

    // Act
    const result = checkUsageLimits(offer, aCart(), aSnapshot());

    // Assert
    expect(result).toBe('usage_limit');
  });

  it('applies an offer one use below its total limit', () => {
    // Arrange
    const offer = anOffer({ totalUsageLimit: 100, usageCount: 99 });

    // Act
    const result = checkUsageLimits(offer, aCart(), aSnapshot());

    // Assert
    expect(result).toBeNull();
  });

  it('skips an offer whose per-buyer limit is reached', () => {
    // Arrange
    const offer = anOffer({ id: '7001', perBuyerLimit: 1 });
    const snapshot = aSnapshot({ perBuyerUsage: new Map([['7001', 1]]) });

    // Act
    const result = checkUsageLimits(offer, aCart({ buyer: A_BUYER }), snapshot);

    // Assert
    expect(result).toBe('per_buyer_limit');
  });

  it('applies a per-buyer limited offer to a buyer who has not used it', () => {
    // Arrange
    const offer = anOffer({ id: '7001', perBuyerLimit: 2 });
    const snapshot = aSnapshot({ perBuyerUsage: new Map([['7001', 1]]) });

    // Act
    const result = checkUsageLimits(offer, aCart({ buyer: A_BUYER }), snapshot);

    // Assert
    expect(result).toBeNull();
  });

  it('skips a per-buyer limited offer without a phone', () => {
    // Arrange
    const offer = anOffer({ perBuyerLimit: 1 });

    // Act
    const result = checkUsageLimits(offer, aCart({ buyer: null }), aSnapshot());

    // Assert
    expect(result).toBe('per_buyer_limit');
  });
});
