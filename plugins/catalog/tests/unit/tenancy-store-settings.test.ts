import { findTenant, type StoreSettingsReader } from '@cod/plugin-tenancy';
import type { TenantContext } from '@cod/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { asOperationContext } from '../../domain/ports/operation-context';
import { TenancyStoreSettings } from '../../infrastructure/tenancy-store-settings.adapter';
import { scopeA } from '../support/builders';

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
  const reader: StoreSettingsReader = { settingsOf };
  return { stores: new TenancyStoreSettings(reader), settingsOf };
}

describe('TenancyStoreSettings.activeStoreOf (D2142)', () => {
  beforeEach(() => {
    vi.mocked(findTenant).mockReturnValue(tenant);
  });

  it("answers the tenant's active store and its sold-out behaviour", async () => {
    // Arrange
    const { stores, settingsOf } = storesAnswering(activeSettings);

    // Act
    const store = await stores.activeStoreOf(ctx);

    // Assert
    expect(store).toEqual({ scope: scopeA, soldOutBehavior: 'hide' });
    expect(settingsOf).toHaveBeenCalledWith(expect.anything(), scopeA.businessId, scopeA.storeId);
  });

  it('answers no store for a request without a tenant, without reading settings', async () => {
    // Arrange
    vi.mocked(findTenant).mockReturnValue(undefined);
    const { stores, settingsOf } = storesAnswering(activeSettings);

    // Act
    const store = await stores.activeStoreOf(ctx);

    // Assert
    expect(store).toBeUndefined();
    expect(settingsOf).not.toHaveBeenCalled();
  });

  it.each<[string, Settings]>([
    ['an unknown store', null],
    ['an archived store', { ...activeSettings, status: 'archived' }],
    ["a store whose channel is not the request's", { ...activeSettings, channelId: REQUEST_CHANNEL + 1 }],
  ])('answers no store for %s', async (_case, settings) => {
    // Arrange
    const { stores } = storesAnswering(settings);

    // Act
    const store = await stores.activeStoreOf(ctx);

    // Assert
    expect(store).toBeUndefined();
  });
});
