import { describe, expect, it } from 'vitest';
import { InvalidStoreLocaleError, toStoreLocale } from '../../src/tenancy/store-locale';

describe('store locale', () => {
  it('accepts the platform languages', () => {
    // Arrange
    const languages = ['ar', 'fr', 'en'];
    // Act
    const locales = languages.map(toStoreLocale);
    // Assert
    expect(locales).toEqual(['ar', 'fr', 'en']);
  });

  it('rejects any other locale at runtime', () => {
    expect(() => toStoreLocale('de')).toThrow(InvalidStoreLocaleError);
  });
});
