import { describe, expect, it } from 'vitest';
import { clampMoney, MONEY_MAX_DZD, percentOf, roundHalfUp } from '../../src/index';

describe('pricing money helpers', () => {
  it('rounds 742.5 half up to 743', () => {
    expect(roundHalfUp(742.5)).toBe(743);
  });

  it('rounds 742.4 down to 742', () => {
    expect(roundHalfUp(742.4)).toBe(742);
  });

  it('takes 10 percent of 4900 as 490', () => {
    expect(percentOf(4900, 10)).toBe(490);
  });

  it('takes 15 percent of 4950 as 743', () => {
    expect(percentOf(4950, 15)).toBe(743);
  });

  it('keeps a whole amount unchanged when rounding', () => {
    expect(roundHalfUp(980)).toBe(980);
  });

  it('clamps money between 0 and the largest int column value', () => {
    expect(clampMoney(-5)).toBe(0);
    expect(clampMoney(MONEY_MAX_DZD + 1)).toBe(MONEY_MAX_DZD);
    expect(clampMoney(8820)).toBe(8820);
  });

  it('rounds a fractional amount half up while clamping', () => {
    expect(clampMoney(1.5)).toBe(2);
    expect(clampMoney(1.4)).toBe(1);
  });

  it('refuses a NaN amount instead of passing it on', () => {
    expect(() => clampMoney(Number.NaN)).toThrow(RangeError);
  });
});
