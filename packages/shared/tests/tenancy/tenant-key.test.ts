import { describe, expect, it } from 'vitest';
import {
  type BusinessId,
  InvalidBusinessIdError,
  InvalidSnowflakeError,
  InvalidTenantKeyPartError,
  type StoreId,
  tenantKey,
  tenantObjectPrefix,
  toBusinessId,
  toStoreId,
} from '../../src/index';

const BUSINESS_A = toBusinessId('1');
const BUSINESS_B = toBusinessId('7');
const STORE = toStoreId('2');

function messageOf(act: () => unknown): string {
  try {
    act();
  } catch (error) {
    if (error instanceof InvalidTenantKeyPartError) {
      return error.message;
    }
    throw error;
  }
  throw new Error('expected InvalidTenantKeyPartError');
}

describe('tenantKey', () => {
  it('gives two businesses different keys for one name', () => {
    // Arrange
    const name = 'products';

    // Act
    const keyA = tenantKey({ businessId: BUSINESS_A }, name);
    const keyB = tenantKey({ businessId: BUSINESS_B }, name);

    // Assert
    expect(keyA).toBe('b:1:products');
    expect(keyB).toBe('b:7:products');
  });

  it('gives a store key distinct from the business key', () => {
    const storeKey = tenantKey({ businessId: BUSINESS_A, storeId: STORE }, 'products', 'list');

    expect(storeKey).toBe('b:1:s:2:products:list');
    expect(storeKey).not.toBe(tenantKey({ businessId: BUSINESS_A }, 'products', 'list'));
  });

  it("refuses a part containing ':' or '/'", () => {
    expect(() => tenantKey({ businessId: BUSINESS_A }, 's:2')).toThrow(InvalidTenantKeyPartError);
    expect(() => tenantKey({ businessId: BUSINESS_A }, '../x')).toThrow(InvalidTenantKeyPartError);
  });

  it('refuses an empty part', () => {
    expect(() => tenantKey({ businessId: BUSINESS_A }, '')).toThrow(InvalidTenantKeyPartError);
  });

  it('refuses an invalid business id', () => {
    const forged = '1:s:2' as BusinessId;

    expect(() => tenantKey({ businessId: forged }, 'products')).toThrow(InvalidBusinessIdError);
  });

  it('a business key cannot be spelled as a store key', () => {
    const storeKey = tenantKey({ businessId: BUSINESS_A, storeId: STORE }, 'products');

    expect(() => tenantKey({ businessId: BUSINESS_A }, 's', '2', 'products')).toThrow(InvalidTenantKeyPartError);
    expect(storeKey).toBe('b:1:s:2:products');
  });

  it('refuses the reserved segment markers as a part in every scope', () => {
    expect(() => tenantKey({ businessId: BUSINESS_A }, 'b', '7', 'products')).toThrow(InvalidTenantKeyPartError);
    expect(() => tenantKey({ businessId: BUSINESS_A, storeId: STORE }, 'products', 's')).toThrow(
      InvalidTenantKeyPartError,
    );
  });

  it('refuses glob characters, whitespace and control characters in a part', () => {
    for (const part of ['*', 'a?', '[ab]', 'a\\b', 'a b', 'a\nb', 'a\u0000b', 'a\u0085b']) {
      expect(() => tenantKey({ businessId: BUSINESS_A }, part)).toThrow(InvalidTenantKeyPartError);
    }
  });

  it('accepts an Arabic slug as a part', () => {
    expect(tenantKey({ businessId: BUSINESS_A }, 'حذاء-رياضي')).toBe('b:1:حذاء-رياضي');
  });

  it('refuses a key that names no resource', () => {
    const noParts = tenantKey as unknown as (scope: { businessId: BusinessId }) => string;

    expect(() => noParts({ businessId: BUSINESS_A })).toThrow(InvalidTenantKeyPartError);
  });

  it('refuses an invalid store id', () => {
    expect(() => tenantKey({ businessId: BUSINESS_A, storeId: '2:x' as StoreId }, 'products')).toThrow(
      InvalidSnowflakeError,
    );
    expect(() => tenantKey({ businessId: BUSINESS_A, storeId: '2:s:3' as StoreId }, 'products')).toThrow(
      InvalidSnowflakeError,
    );
  });

  it('keeps the error message bounded and escaped', () => {
    // Arrange
    const part = `\u001b[31m${'x'.repeat(200)}`;

    // Act
    const message = messageOf(() => tenantKey({ businessId: BUSINESS_A }, part));

    // Assert
    expect(message).not.toContain('\u001b');
    expect(message.length).toBeLessThan(120);
  });

  it('carries the stable error code', () => {
    expect(() => tenantKey({ businessId: BUSINESS_A }, '')).toThrow(
      expect.objectContaining({ code: 'tenancy.invalid-key-part' }),
    );
  });
});

describe('tenantObjectPrefix', () => {
  it('prefixes objects as b/1/s/2/', () => {
    expect(tenantObjectPrefix({ businessId: BUSINESS_A, storeId: STORE })).toBe('b/1/s/2/');
  });

  it('prefixes a business-only object as b/1/', () => {
    expect(tenantObjectPrefix({ businessId: BUSINESS_A })).toBe('b/1/');
  });

  it('refuses an invalid business id', () => {
    expect(() => tenantObjectPrefix({ businessId: '../1' as BusinessId })).toThrow(InvalidBusinessIdError);
  });

  it('refuses an invalid store id', () => {
    expect(() => tenantObjectPrefix({ businessId: BUSINESS_A, storeId: '../2' as StoreId })).toThrow(
      InvalidSnowflakeError,
    );
    expect(() => tenantObjectPrefix({ businessId: BUSINESS_A, storeId: '2/../3' as StoreId })).toThrow(
      expect.objectContaining({ code: 'ids.invalid-snowflake' }),
    );
  });
});
