import { describe, expect, it } from 'vitest';
import {
  type BusinessId,
  InvalidBusinessIdError,
  InvalidSnowflakeError,
  InvalidTenantKeyPartError,
  MAX_OBJECT_KEY_BYTES,
  ObjectKeyTooLongError,
  type StoreId,
  tenantKey,
  tenantObjectKey,
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

  it('refuses a non-string part in any position', () => {
    // Arrange
    const untyped = tenantKey as unknown as (scope: { businessId: BusinessId }, ...parts: unknown[]) => string;
    const scope = { businessId: BUSINESS_A };

    // Act + Assert
    for (const bad of [undefined, null, 5]) {
      expect(() => untyped(scope, bad)).toThrow(InvalidTenantKeyPartError);
      expect(() => untyped(scope, 'a', bad)).toThrow(InvalidTenantKeyPartError);
    }
  });

  it('refuses a lone surrogate in a part', () => {
    // Two lone surrogates both encode to U+FFFD in UTF-8, so the keys would collide on the wire.
    expect(() => tenantKey({ businessId: BUSINESS_A }, 'a\uD800')).toThrow(InvalidTenantKeyPartError);
    expect(() => tenantKey({ businessId: BUSINESS_A }, 'a\uDC01')).toThrow(InvalidTenantKeyPartError);
    expect(tenantKey({ businessId: BUSINESS_A }, 'a\u{1F600}')).toBe('b:1:a\u{1F600}');
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

describe('tenantObjectPrefix isolation', () => {
  it('gives two businesses disjoint object prefixes', () => {
    // Arrange
    const prefixes = [
      tenantObjectPrefix({ businessId: BUSINESS_A }),
      tenantObjectPrefix({ businessId: BUSINESS_A, storeId: STORE }),
      tenantObjectPrefix({ businessId: BUSINESS_B }),
      tenantObjectPrefix({ businessId: BUSINESS_B, storeId: STORE }),
      tenantObjectPrefix({ businessId: toBusinessId('11') }),
    ];
    const businessOf = (prefix: string): string => prefix.split('/')[1] ?? '';

    // Act + Assert
    for (const left of prefixes) {
      for (const right of prefixes) {
        if (businessOf(left) !== businessOf(right)) {
          expect(right.startsWith(left)).toBe(false);
        }
      }
    }
  });
});

describe('tenantObjectKey', () => {
  it('appends the parts to the tenant prefix', () => {
    expect(tenantObjectKey({ businessId: BUSINESS_A, storeId: STORE }, 'source', '3f', 'abc.png')).toBe(
      'b/1/s/2/source/3f/abc.png',
    );
  });

  it('a business object cannot land in a store namespace', () => {
    expect(() => tenantObjectKey({ businessId: BUSINESS_A }, 's', '2', 'abc.png')).toThrow(InvalidTenantKeyPartError);
  });

  it('refuses path traversal, separators and empty parts', () => {
    for (const part of ['..', '.', '', '../x', 'a/b', 'a\\b']) {
      expect(() => tenantObjectKey({ businessId: BUSINESS_A }, 'source', part)).toThrow(InvalidTenantKeyPartError);
    }
  });

  it('refuses a key that names no object', () => {
    const noParts = tenantObjectKey as unknown as (scope: { businessId: BusinessId }) => string;

    expect(() => noParts({ businessId: BUSINESS_A })).toThrow(InvalidTenantKeyPartError);
  });

  it('refuses percent-encoded dot segments and separators', () => {
    // A store that decodes before normalising would read `%2e%2e` as `..` and `%2F` as `/`.
    for (const part of ['%2e%2e', '%2E', '..%2F..%2Fb%2F7%2Fx.png', 'a%5Cb', '100%']) {
      expect(() => tenantObjectKey({ businessId: BUSINESS_A }, 'source', part)).toThrow(InvalidTenantKeyPartError);
    }
  });

  it('accepts a key of exactly the store limit in UTF-8 bytes', () => {
    // Arrange: 'b/1/' is 4 bytes, each Arabic letter 2 bytes
    const part = 'ح'.repeat((MAX_OBJECT_KEY_BYTES - 4) / 2);

    // Act
    const key = tenantObjectKey({ businessId: BUSINESS_A }, part);

    // Assert
    expect(new TextEncoder().encode(key).length).toBe(MAX_OBJECT_KEY_BYTES);
  });

  it('refuses a key longer than the store limit in UTF-8 bytes', () => {
    // Arrange: fewer than 1024 UTF-16 units, but more than 1024 UTF-8 bytes
    const part = 'ح'.repeat((MAX_OBJECT_KEY_BYTES - 4) / 2 + 1);

    // Act + Assert
    expect(part.length).toBeLessThan(MAX_OBJECT_KEY_BYTES);
    expect(() => tenantObjectKey({ businessId: BUSINESS_A }, part)).toThrow(ObjectKeyTooLongError);
    expect(() => tenantObjectKey({ businessId: BUSINESS_A }, 'x'.repeat(5000))).toThrow(
      expect.objectContaining({ code: 'tenancy.object-key-too-long' }),
    );
  });
});
