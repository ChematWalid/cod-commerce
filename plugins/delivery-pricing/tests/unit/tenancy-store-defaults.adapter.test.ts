import type { BusinessStoreDirectory, StoreDeliveryDefaults, StoreSettingsReader } from '@cod/plugin-tenancy';
import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { TenancyStoreDefaults } from '../../infrastructure/tenancy-store-defaults.adapter';
import { ctx, STORE_A1, STORE_B1 } from '../support/world';

describe('TenancyStoreDefaults.activeStores', () => {
  it("answers the active stores' scopes only, without their linked default group", async () => {
    // Arrange
    const directory = {
      activeStoreLinks: () =>
        Promise.resolve([
          { ...STORE_A1, defaultDeliveryFeeGroupId: toSnowflake('77') },
          { ...STORE_B1, defaultDeliveryFeeGroupId: null },
        ]),
    } as unknown as BusinessStoreDirectory;
    const adapter = new TenancyStoreDefaults({} as StoreSettingsReader, {} as StoreDeliveryDefaults, directory);

    // Act
    const page = await adapter.activeStores(ctx, undefined, 10);

    // Assert
    expect(page).toEqual([STORE_A1, STORE_B1]);
  });
});
