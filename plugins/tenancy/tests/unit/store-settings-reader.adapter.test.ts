import { type BusinessId, type StoreId, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { TenantStoresPort } from '../../domain/ports/tenant-stores.port';
import { newStore, type Store } from '../../domain/store';
import { TenantStoreSettingsReader } from '../../infrastructure/store-settings-reader.adapter';

const BUSINESS = toBusinessId('1000000000000000001');
const STORE = toStoreId(toSnowflake('1000000000000000002'));
const GROUP = toSnowflake('1000000000000000003');
const ctx = {} as OperationContext;

/** A business's stores held in memory: `find` answers only a store of the named business. */
function storesWith(store: Store): TenantStoresPort {
  const owned = (businessId: BusinessId, id: StoreId) => String(store.businessId) === businessId && store.id === id;
  return {
    list: () => Promise.resolve([store]),
    find: (_ctx, businessId, id) => Promise.resolve(owned(businessId, id) ? store : undefined),
    findForUpdate: (_ctx, businessId, id) => Promise.resolve(owned(businessId, id) ? store : undefined),
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

describe('TenantStoreSettingsReader', () => {
  it("reads the store's default delivery fee group with its other settings (D3111)", async () => {
    // Arrange
    const reader = new TenantStoreSettingsReader(storesWith(store({ defaultDeliveryFeeGroupId: GROUP })));

    // Act
    const settings = await reader.settingsOf(ctx, BUSINESS, STORE);

    // Assert
    expect(settings).toEqual({
      soldOutBehavior: 'keep',
      language: 'ar',
      channelId: 7,
      status: 'active',
      defaultDeliveryFeeGroupId: GROUP,
    });
  });

  it('reads no default delivery fee group as null', async () => {
    // Arrange
    const reader = new TenantStoreSettingsReader(storesWith(store()));

    // Act
    const settings = await reader.settingsOf(ctx, BUSINESS, STORE);

    // Assert
    expect(settings?.defaultDeliveryFeeGroupId).toBeNull();
  });

  it('answers null for a store of another business', async () => {
    // Arrange
    const reader = new TenantStoreSettingsReader(storesWith(store()));

    // Act and Assert
    await expect(reader.settingsOf(ctx, toBusinessId('1000000000000000009'), STORE)).resolves.toBeNull();
  });
});
