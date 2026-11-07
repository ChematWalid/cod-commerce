import { describe, expect, it } from 'vitest';
import { WILAYA_CODES, WILAYA_COUNT, WILAYAS, isWilayaCode } from '../src/index';

describe('wilayas', () => {
  it('lists the 58 wilaya codes in order', () => {
    expect(WILAYA_CODES).toHaveLength(58);
    expect(WILAYA_COUNT).toBe(58);
    expect(WILAYA_CODES[0]).toBe('01');
    expect(WILAYA_CODES[57]).toBe('58');
    expect(new Set(WILAYA_CODES).size).toBe(58);
  });

  it('names Algiers in Arabic and French', () => {
    const algiers = WILAYAS.find((wilaya) => wilaya.code === '16');

    expect(algiers?.names).toEqual({ ar: 'الجزائر', fr: 'Alger' });
  });

  it('accepts only two-digit codes between 01 and 58', () => {
    expect(isWilayaCode('59')).toBe(false);
    expect(isWilayaCode('7')).toBe(false);
    expect(isWilayaCode('07')).toBe(true);
  });
});
