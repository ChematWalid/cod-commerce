import { describe, expect, it } from 'vitest';
import { formatDzd, formatMessage, storefrontMessages } from '../../src/storefront/i18n/catalogue';

/** Turns every kind of space Intl may use for grouping into a plain space. */
function plainSpaces(text: string): string {
  return text.replace(/\s/gu, ' ');
}

describe('storefront catalogue formatter', () => {
  it('uses the Arabic "two" form for a count of 2', () => {
    // Arrange
    const forms = storefrontMessages('ar')['cart.items'];
    // Act
    const text = formatMessage('ar', 'cart.items', { count: 2 });
    // Assert
    expect(typeof forms === 'object' ? forms.two : undefined).toBe(text);
  });

  it.each([
    [0, 'zero'],
    [1, 'one'],
    [3, 'few'],
    [11, 'many'],
    [100, 'other'],
  ] as const)('uses the Arabic %s form for a count of %i', (count, form) => {
    const forms = storefrontMessages('ar')['cart.items'];
    const expected = typeof forms === 'object' ? (forms[form] ?? '') : '';
    expect(formatMessage('ar', 'cart.items', { count })).toBe(expected.replace('{count}', String(count)));
  });

  it('falls back to the "other" form when a language has no form of its own', () => {
    // French has a "many" category for large round numbers; the catalogue only needs one/other.
    expect(formatMessage('fr', 'cart.items', { count: 1_000_000 })).toContain('1');
  });

  it('fills named placeholders', () => {
    expect(formatMessage('en', 'search.empty', { query: 'kaftan' })).toContain('kaftan');
  });

  it('leaves an unknown placeholder visible rather than dropping it', () => {
    expect(formatMessage('en', 'search.empty', {})).toContain('{query}');
  });

  it('formats DZD with Latin digits and grouping in Arabic', () => {
    // Act
    const text = formatDzd('ar', 12500);
    // Assert
    expect(text).toMatch(/12.500/u);
    expect(text).toContain('د.ج');
  });

  it('formats DZD the French way', () => {
    expect(plainSpaces(formatDzd('fr', 12500))).toBe('12 500 DA');
  });

  it('formats DZD the English way', () => {
    expect(formatDzd('en', 12500)).toBe('12,500 DA');
  });
});
