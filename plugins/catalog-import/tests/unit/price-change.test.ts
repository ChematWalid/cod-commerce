import { MONEY_MAX_DZD } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { applyPriceChange } from '../../domain/price-change';

describe('bulk price change (D2213)', () => {
  it('+10 % of 1 999 is 2 199 (half-up)', () => {
    // Act
    const price = applyPriceChange(1999, { mode: 'percent', value: 10 });

    // Assert
    expect(price).toBe(2199);
  });

  it('rounds an exact half up (+10 % of 5 is 6)', () => {
    // Act and Assert
    expect(applyPriceChange(5, { mode: 'percent', value: 10 })).toBe(6);
  });

  it('a fractional percent is not thrown off by binary rounding (+10.1 % of 1 000 is 1 101)', () => {
    // Act and Assert
    expect(applyPriceChange(1000, { mode: 'percent', value: 10.1 })).toBe(1101);
  });

  it('-100 % gives 0', () => {
    // Act and Assert
    expect(applyPriceChange(1999, { mode: 'percent', value: -100 })).toBe(0);
  });

  it('amount -500 on 300 is an error', () => {
    // Act and Assert
    expect(applyPriceChange(300, { mode: 'amount', value: -500 })).toBeUndefined();
  });

  it('amount +500 on 300 is 800', () => {
    // Act and Assert
    expect(applyPriceChange(300, { mode: 'amount', value: 500 })).toBe(800);
  });

  it('a result above the money maximum is an error', () => {
    // Act and Assert
    expect(applyPriceChange(MONEY_MAX_DZD, { mode: 'percent', value: 1 })).toBeUndefined();
  });

  it('fixed sets every variant', () => {
    // Act
    const prices = [100, 2500, 0].map((price) => applyPriceChange(price, { mode: 'fixed', value: 1200 }));

    // Assert
    expect(prices).toEqual([1200, 1200, 1200]);
  });
});
