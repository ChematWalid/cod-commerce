import { describe, expect, it } from 'vitest';
import type { NormalizedHost } from '../../src/tenancy/host';
import { InvalidStoreLocaleError, type StoreLocale, toStoreLocale } from '../../src/tenancy/store-locale';
import { StubStoreResolver } from '../../src/tenancy/stub-store-resolver';

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

  it('the stub resolver refuses a store with an unknown locale', () => {
    // Arrange: store data comes from outside the type system, so the cast stands for a bad record.
    const store = {
      storeId: 'bad',
      businessId: 'stub-business-c',
      name: 'Bad Store',
      defaultLocale: 'de' as StoreLocale,
      primaryHost: 'bad.localhost' as NormalizedHost,
      status: 'active' as const,
    };
    // Act
    const build = (): StubStoreResolver => new StubStoreResolver([store]);
    // Assert
    expect(build).toThrow(InvalidStoreLocaleError);
  });
});
