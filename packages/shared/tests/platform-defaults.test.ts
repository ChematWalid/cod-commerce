import { describe, expect, it } from 'vitest';
import { MONEY_PRECISION, PLATFORM_CURRENCY_CODE, PLATFORM_LANGUAGE_CODES, isPlatformLanguageCode } from '../src/index';

describe('platform defaults', () => {
  it('counts money in whole dinars', () => {
    expect(MONEY_PRECISION).toBe(0);
    expect(PLATFORM_CURRENCY_CODE).toBe('DZD');
  });

  it('supports Arabic, French and English', () => {
    expect(PLATFORM_LANGUAGE_CODES).toEqual(['ar', 'fr', 'en']);
    expect(isPlatformLanguageCode('fr')).toBe(true);
    expect(isPlatformLanguageCode('de')).toBe(false);
  });
});
