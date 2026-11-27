import { describe, expect, it } from 'vitest';
import { WILAYA_CODES, WILAYA_COUNT, WILAYAS, isWilayaCode } from '../src/index';

describe('wilayas', () => {
  it('lists the 69 wilaya codes of law 26-06 in order', () => {
    expect(WILAYA_COUNT).toBe(69);
    expect(WILAYA_CODES).toHaveLength(WILAYA_COUNT);
    expect(WILAYA_CODES[0]).toBe('01');
    expect(WILAYA_CODES.at(-1)).toBe('69');
    expect(new Set(WILAYA_CODES).size).toBe(WILAYA_COUNT);
  });

  it('names Algiers in Arabic and French', () => {
    const algiers = WILAYAS.find((wilaya) => wilaya.code === '16');

    expect(algiers?.names).toEqual({ ar: 'الجزائر', fr: 'Alger' });
  });

  it('accepts only two-digit codes between 01 and 69', () => {
    expect(isWilayaCode('69')).toBe(true);
    expect(isWilayaCode('70')).toBe(false);
    expect(isWilayaCode('7')).toBe(false);
    expect(isWilayaCode('07')).toBe(true);
  });
});
