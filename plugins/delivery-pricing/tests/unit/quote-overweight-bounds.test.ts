import { MAX_OVERWEIGHT_ALLOWANCE_KG, MAX_OVERWEIGHT_RATE } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { quoteDelivery } from '../../domain/quote';
import { input, NO_OVERWEIGHT, OVERWEIGHT, UNRESOLVED } from '../support/quote-fixtures';

describe('quoteDelivery: stored overweight settings out of bounds (D3121, D3134)', () => {
  it.each<[string, Partial<typeof OVERWEIGHT>]>([
    ['a negative overweight rate', { overweightRate: -50 }],
    ['a fractional overweight rate', { overweightRate: 0.5 }],
    ['an overweight rate above its ceiling', { overweightRate: MAX_OVERWEIGHT_RATE + 1 }],
    ['a negative overweight allowance', { overweightAllowanceKg: -5 }],
    ['a fractional overweight allowance', { overweightAllowanceKg: 2.5 }],
    ['an overweight allowance above its ceiling', { overweightAllowanceKg: MAX_OVERWEIGHT_ALLOWANCE_KG + 1 }],
  ])('answers unresolved for %s stored on a group that charges overweight', (_label, fields) => {
    expect(quoteDelivery(input({ group: { ...OVERWEIGHT, ...fields }, weightGrams: 7000 }))).toEqual(UNRESOLVED);
  });

  it('accepts overweight settings at their ceilings', () => {
    // Arrange
    const group = {
      ...OVERWEIGHT,
      overweightAllowanceKg: MAX_OVERWEIGHT_ALLOWANCE_KG,
      overweightRate: MAX_OVERWEIGHT_RATE,
    };

    // Act
    const quote = quoteDelivery(input({ group, weightGrams: 101_000 }));

    // Assert
    expect(quote).toMatchObject({ resolved: true, overweightFee: MAX_OVERWEIGHT_RATE });
  });

  it('ignores the overweight settings of a group that does not charge overweight', () => {
    // Arrange
    const group = { ...NO_OVERWEIGHT, overweightRate: -50 };

    // Act
    const quote = quoteDelivery(input({ group, weightGrams: 7000 }));

    // Assert
    expect(quote).toMatchObject({ resolved: true, overweightFee: 0 });
  });
});
