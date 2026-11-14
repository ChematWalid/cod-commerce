import { describe, expect, it } from 'vitest';
import {
  type BusinessId,
  InvalidBusinessIdError,
  InvalidTenantKeyPartError,
  tenantKey,
  tenantObjectPrefix,
  toBusinessId,
  toStoreId,
} from '../../src/index';

const BUSINESS_A = toBusinessId('1');
const BUSINESS_B = toBusinessId('7');
const STORE = toStoreId('2');

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
});
