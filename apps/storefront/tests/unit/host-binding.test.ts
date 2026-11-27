import { normalizeHost, type NormalizedHost, type StorefrontStore, storefrontStoreSchema } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { HOST_BINDING_LENGTH, hostBindingOf, isHostBindingValid } from '../../src/tenancy/host-binding';
import { createTenantVerifier } from '../../src/tenancy/verified-tenant';

const OLD_KEY = { kid: 'k1', secret: 'unit-old-binding-key-0000000000000000000' };
const NEW_KEY = { kid: 'k2', secret: 'unit-new-binding-key-0000000000000000000' };
const STORE_A = '1001';
const STORE_B = '2002';

function host(value: string): NormalizedHost {
  const normalized = normalizeHost(value);
  if (normalized === null) throw new Error(`bad test host ${value}`);
  return normalized;
}

const HOST_A = host('demo.localhost');
const HOST_B = host('second.localhost');

function storeOf(storeId: string, primaryHost: string, language: StorefrontStore['language']): StorefrontStore {
  return storefrontStoreSchema.parse({
    storeId,
    businessId: storeId === STORE_A ? '1' : '2',
    name: `Store ${storeId}`,
    description: '',
    logoPath: null,
    language,
    direction: language === 'ar' ? 'rtl' : 'ltr',
    primaryHost,
    showAddressField: true,
    soldOutBehavior: 'keep',
    status: 'active',
  });
}

const STORES: Record<string, StorefrontStore> = {
  [STORE_A]: storeOf(STORE_A, HOST_A, 'ar'),
  [STORE_B]: storeOf(STORE_B, HOST_B, 'fr'),
};

function verifierWith(keys = [OLD_KEY, NEW_KEY]) {
  const loadStore = vi.fn((storeId: string) => Promise.resolve(STORES[storeId] ?? null));
  return { verify: createTenantVerifier({ loadStore, verifyKeys: () => keys }), loadStore };
}

describe('host binding', () => {
  it('is 22 base64url characters and stable for one store, host and key', () => {
    // Act
    const binding = hostBindingOf(NEW_KEY, STORE_A, HOST_A);
    // Assert
    expect(binding).toMatch(new RegExp(`^[A-Za-z0-9_-]{${String(HOST_BINDING_LENGTH)}}$`));
    expect(hostBindingOf(NEW_KEY, STORE_A, HOST_A)).toBe(binding);
  });

  it('rejects the binding of (A, hostA) presented for store B on hostA', () => {
    const binding = hostBindingOf(NEW_KEY, STORE_A, HOST_A);
    expect(isHostBindingValid([NEW_KEY], STORE_B, HOST_A, binding)).toBe(false);
  });

  it('rejects the binding of (A, hostA) presented for store A on hostB', () => {
    const binding = hostBindingOf(NEW_KEY, STORE_A, HOST_A);
    expect(isHostBindingValid([NEW_KEY], STORE_A, HOST_B, binding)).toBe(false);
  });

  it('accepts a binding signed with any configured key, so a key rotation keeps old paths valid', () => {
    // Arrange
    const signedWithOldKey = hostBindingOf(OLD_KEY, STORE_A, HOST_A);
    // Act
    const valid = isHostBindingValid([NEW_KEY, OLD_KEY], STORE_A, HOST_A, signedWithOldKey);
    // Assert
    expect(valid).toBe(true);
  });

  it('rejects a binding signed with a key that is no longer configured', () => {
    const signedWithOldKey = hostBindingOf(OLD_KEY, STORE_A, HOST_A);
    expect(isHostBindingValid([NEW_KEY], STORE_A, HOST_A, signedWithOldKey)).toBe(false);
  });

  it.each(['', 'short', 'x'.repeat(HOST_BINDING_LENGTH + 1), `${'a'.repeat(HOST_BINDING_LENGTH - 1)}%`])(
    'rejects the malformed binding %j without throwing',
    (binding) => {
      expect(isHostBindingValid([NEW_KEY], STORE_A, HOST_A, binding)).toBe(false);
    },
  );
});

describe('tenant verifier', () => {
  it('returns the tenant for a binding of the store on its own primary host', async () => {
    // Arrange
    const { verify } = verifierWith();
    const binding = hostBindingOf(NEW_KEY, STORE_A, HOST_A);
    // Act
    const tenant = await verify({ locale: 'ar', storeId: STORE_A, binding });
    // Assert
    expect(tenant?.storeId).toBe(STORE_A);
    expect(tenant?.store.name).toBe(`Store ${STORE_A}`);
  });

  it("gives no tenant, so no store data, for store B's path carrying store A's binding", async () => {
    // Arrange: a binding the proxy produced on host A, replayed with B's id.
    const { verify } = verifierWith();
    const bindingOfA = hostBindingOf(NEW_KEY, STORE_A, HOST_A);
    // Act
    const tenant = await verify({ locale: 'fr', storeId: STORE_B, binding: bindingOfA });
    // Assert
    expect(tenant).toBeNull();
  });

  it('gives no tenant for a binding computed on another host than the primary one', async () => {
    const { verify } = verifierWith();
    const binding = hostBindingOf(NEW_KEY, STORE_A, HOST_B);
    await expect(verify({ locale: 'ar', storeId: STORE_A, binding })).resolves.toBeNull();
  });

  it("renders in the store's language when the path's locale is stale but the binding is valid", async () => {
    // Arrange: the store switched to Arabic while the edge still holds a French path for a minute.
    const { verify } = verifierWith();
    const binding = hostBindingOf(NEW_KEY, STORE_A, HOST_A);
    // Act
    const tenant = await verify({ locale: 'fr', storeId: STORE_A, binding });
    // Assert
    expect(tenant?.locale).toBe('ar');
  });

  it.each(['de', '', 'AR'])('gives no tenant for the locale %j without asking the api', async (locale) => {
    // Arrange
    const { verify, loadStore } = verifierWith();
    const binding = hostBindingOf(NEW_KEY, STORE_A, HOST_A);
    // Act
    const tenant = await verify({ locale, storeId: STORE_A, binding });
    // Assert
    expect(tenant).toBeNull();
    expect(loadStore).not.toHaveBeenCalled();
  });

  it.each(['short', 'a'.repeat(HOST_BINDING_LENGTH + 1), `${'a'.repeat(HOST_BINDING_LENGTH - 1)}=`])(
    'gives no tenant for the malformed binding %j without asking the api',
    async (binding) => {
      // Arrange
      const { verify, loadStore } = verifierWith();
      // Act
      const tenant = await verify({ locale: 'ar', storeId: STORE_A, binding });
      // Assert
      expect(tenant).toBeNull();
      expect(loadStore).not.toHaveBeenCalled();
    },
  );

  it.each(['prerender-sentinel', '0', '01', 'abc', '1'.repeat(20), '../2002'])(
    'gives no tenant for the store id %j without asking the api',
    async (storeId) => {
      // Arrange
      const { verify, loadStore } = verifierWith();
      // Act
      const tenant = await verify({ locale: 'ar', storeId, binding: 'a'.repeat(HOST_BINDING_LENGTH) });
      // Assert
      expect(tenant).toBeNull();
      expect(loadStore).not.toHaveBeenCalled();
    },
  );

  it('gives no tenant for an unknown store', async () => {
    const { verify } = verifierWith();
    const binding = hostBindingOf(NEW_KEY, '3003', HOST_A);
    await expect(verify({ locale: 'ar', storeId: '3003', binding })).resolves.toBeNull();
  });
});
