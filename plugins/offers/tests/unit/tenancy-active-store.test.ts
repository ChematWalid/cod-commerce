import { findTenant, type StoreSettingsReader } from '@cod/plugin-tenancy';
import type { TenantContext } from '@cod/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { TenancyActiveStore } from '../../infrastructure/tenancy-active-store.adapter';
import { scopeA } from '../support/offer-records';

vi.mock('@cod/plugin-tenancy', async (original) => ({
  ...(await original<typeof import('@cod/plugin-tenancy')>()),
  findTenant: vi.fn(),
}));

type Settings = Awaited<ReturnType<StoreSettingsReader['settingsOf']>>;

const REQUEST_CHANNEL = 7;
const ctx = asOperationContext({ channelId: REQUEST_CHANNEL });
const tenant: TenantContext = {
  businessId: scopeA.businessId,
  storeIds: [scopeA.storeId],
  activeStoreId: scopeA.storeId,
};
const activeSettings: NonNullable<Settings> = {
  soldOutBehavior: 'hide',
  language: 'ar',
  channelId: REQUEST_CHANNEL,
  status: 'active',
};

/** The adapter over a reader answering `settings`. */
function storesAnswering(settings: Settings) {
  const settingsOf = vi.fn<StoreSettingsReader['settingsOf']>().mockResolvedValue(settings);
  return new TenancyActiveStore({ settingsOf });
}

const refusedStores: [string, Settings][] = [
  ['an unknown store', null],
  ['an archived store', { ...activeSettings, status: 'archived' }],
  ["a store whose channel is not the request's", { ...activeSettings, channelId: REQUEST_CHANNEL + 1 }],
];

describe('TenancyActiveStore.activeStoreOf (D2408)', () => {
  beforeEach(() => {
    vi.mocked(findTenant).mockReturnValue(tenant);
  });

  it("answers the tenant's active store on the request's channel", async () => {
    // Arrange
    const stores = storesAnswering(activeSettings);

    // Act
    const scope = await stores.activeStoreOf(ctx);

    // Assert
    expect(scope).toEqual(scopeA);
  });

  it.each(refusedStores)('answers no store for %s', async (_case, settings) => {
    // Arrange
    const stores = storesAnswering(settings);

    // Act
    const scope = await stores.activeStoreOf(ctx);

    // Assert
    expect(scope).toBeUndefined();
  });
});

describe('TenancyActiveStore.isChannelOf (D2408)', () => {
  it("accepts an active store whose channel is the context's", async () => {
    // Arrange
    const stores = storesAnswering(activeSettings);

    // Act
    const paired = await stores.isChannelOf(ctx, scopeA);

    // Assert
    expect(paired).toBe(true);
  });

  it.each(refusedStores)('refuses %s', async (_case, settings) => {
    // Arrange
    const stores = storesAnswering(settings);

    // Act
    const paired = await stores.isChannelOf(ctx, scopeA);

    // Assert
    expect(paired).toBe(false);
  });
});
