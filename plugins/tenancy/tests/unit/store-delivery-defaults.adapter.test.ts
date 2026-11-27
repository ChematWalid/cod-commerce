import { type BusinessId, type StoreId, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { StoreReferenceRegistry } from '../../application/store-reference.registry';
import { StoreNotFoundError } from '../../domain/errors';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { TenantStoresPort } from '../../domain/ports/tenant-stores.port';
import { newStore, type Store } from '../../domain/store';
import { TenantStoreDeliveryDefaults } from '../../infrastructure/store-delivery-defaults.adapter';

const BUSINESS = toBusinessId('1000000000000000001');
const STORE = toStoreId(toSnowflake('1000000000000000002'));
const GROUP = toSnowflake('1000000000000000003');
const ctx = {} as OperationContext;
const scope = { businessId: BUSINESS, storeId: STORE };

/** A business's stores in memory; records which reads locked the row. */
function storesWith(store: Store): TenantStoresPort & { readonly reads: string[] } {
  const reads: string[] = [];
  const owned = (businessId: BusinessId, id: StoreId) => String(store.businessId) === businessId && store.id === id;
  return {
    reads,
    list: () => Promise.resolve([store]),
    find: (_ctx, businessId, id) => {
      reads.push('find');
      return Promise.resolve(owned(businessId, id) ? store : undefined);
    },
    findForUpdate: (_ctx, businessId, id) => {
      reads.push('findForUpdate');
      return Promise.resolve(owned(businessId, id) ? store : undefined);
    },
    countActive: () => Promise.resolve(1),
    update: () => Promise.resolve(),
  };
}

const store = (fields: Partial<Store> = {}): Store => ({
  ...newStore({
    id: STORE,
    businessId: toSnowflake(BUSINESS),
    channelId: 7,
    sellerId: 3,
    subdomain: 'shop',
    input: { name: 'Shop', subdomain: 'shop', language: 'ar' },
    now: new Date('2026-11-22T10:00:00.000Z'),
  }),
  ...fields,
});

describe('TenantStoreDeliveryDefaults.lockDefaultDeliveryFeeGroup (D3112)', () => {
  it("answers the store's default fee group read under the row lock", async () => {
    // Arrange
    const stores = storesWith(store({ defaultDeliveryFeeGroupId: GROUP }));
    const defaults = new TenantStoreDeliveryDefaults(stores, new StoreReferenceRegistry());

    // Act
    const groupId = await defaults.lockDefaultDeliveryFeeGroup(ctx, scope);

    // Assert
    expect(groupId).toBe(GROUP);
    expect(stores.reads).toEqual(['findForUpdate']);
  });

  it('answers null when the store has no default', async () => {
    // Arrange
    const defaults = new TenantStoreDeliveryDefaults(storesWith(store()), new StoreReferenceRegistry());

    // Act and Assert
    await expect(defaults.lockDefaultDeliveryFeeGroup(ctx, scope)).resolves.toBeNull();
  });

  it('refuses a store of another business', async () => {
    // Arrange
    const defaults = new TenantStoreDeliveryDefaults(storesWith(store()), new StoreReferenceRegistry());

    // Act and Assert
    await expect(
      defaults.lockDefaultDeliveryFeeGroup(ctx, { businessId: toBusinessId('1000000000000000009'), storeId: STORE }),
    ).rejects.toBeInstanceOf(StoreNotFoundError);
  });
});
