import { describe, expect, it } from 'vitest';
import { directionOf, storefrontStoreSchema } from '../../src/storefront/store-dto';

/** A valid `/store/resolve` body of an Arabic store. */
const ARABIC_STORE = {
  storeId: '7300000000000000001',
  businessId: '42',
  name: 'متجر التجربة',
  description: 'ملابس تقليدية',
  logoPath: 'source/ab/logo.png',
  logo: 'source/ab/logo.png',
  language: 'ar',
  direction: 'rtl',
  primaryHost: 'demo.localhost',
  showAddressField: true,
  soldOutBehavior: 'keep',
  status: 'active',
} as const;

describe('storefront store contract', () => {
  it('accepts the resolve body of an active Arabic store', () => {
    expect(storefrontStoreSchema.safeParse(ARABIC_STORE).success).toBe(true);
  });

  it('accepts a store without a logo and without the legacy logo alias', () => {
    // Arrange
    const store: Record<string, unknown> = { ...ARABIC_STORE, logoPath: null };
    delete store['logo'];
    // Act
    const result = storefrontStoreSchema.safeParse(store);
    // Assert
    expect(result.success).toBe(true);
  });

  it.each(['0', '01', '-1', 'demo', '1e3', '99999999999999999999'])('rejects the store id %j', (storeId) => {
    expect(storefrontStoreSchema.safeParse({ ...ARABIC_STORE, storeId }).success).toBe(false);
  });

  it('rejects a numeric store id', () => {
    expect(storefrontStoreSchema.safeParse({ ...ARABIC_STORE, storeId: 7 }).success).toBe(false);
  });

  it('rejects a direction that contradicts the language', () => {
    expect(storefrontStoreSchema.safeParse({ ...ARABIC_STORE, direction: 'ltr' }).success).toBe(false);
  });

  it('rejects a store that is not active', () => {
    expect(storefrontStoreSchema.safeParse({ ...ARABIC_STORE, status: 'disabled' }).success).toBe(false);
  });

  it('rejects an unknown sold-out behaviour', () => {
    expect(storefrontStoreSchema.safeParse({ ...ARABIC_STORE, soldOutBehavior: 'grey' }).success).toBe(false);
  });

  it('writes Arabic right to left and French and English left to right', () => {
    expect([directionOf('ar'), directionOf('fr'), directionOf('en')]).toEqual(['rtl', 'ltr', 'ltr']);
  });
});
