import { FLAG_KEYS, toBusinessId } from '@cod/shared';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FeatureFlags } from '../../application/feature-flags.service';
import { FlagAdminService } from '../../application/flag-admin.service';
import { FlagSeedService } from '../../application/flag-seed.service';
import { clearFlagKeys, createFlagsTestEnvironment } from './flags-kit';

const SNOWFLAKE_WORKER_ID = 1020;
const APP_ENV = 'test-platform-flags-isolation';
const KEY = FLAG_KEYS.ai;
const ACTOR = 'isolation-test';

describe('flag overrides between two businesses', () => {
  const { server, adminClient } = createFlagsTestEnvironment(SNOWFLAKE_WORKER_ID, APP_ENV);
  let businesses: TwoBusinesses;

  const admin = (): FlagAdminService => server.app.get(FlagAdminService);
  const isOn = (businessId: string, storeId?: string): Promise<boolean> =>
    server.app
      .get(FeatureFlags)
      .isEnabledFor({ businessId: toBusinessId(businessId), ...(storeId === undefined ? {} : { storeId }) }, KEY);
  const override = (scope: 'business' | 'store', scopeId: string, enabled: boolean) =>
    admin().setOverride(ACTOR, { key: KEY, scope, scopeId, enabled });
  const clear = (scope: 'business' | 'store', scopeId: string) =>
    admin().removeOverride(ACTOR, { key: KEY, scope, scopeId });

  beforeAll(async () => {
    await clearFlagKeys(APP_ENV);
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    await server.app.get(FlagSeedService).converge();
    await admin().update(ACTOR, { key: KEY, defaultEnabled: false });
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
    await clearFlagKeys(APP_ENV);
  });

  it("turns the flag on for A with A's business override and leaves B on the default", async () => {
    // Arrange
    expect(await isOn(businesses.a.businessId)).toBe(false);
    expect(await isOn(businesses.b.businessId)).toBe(false);

    // Act
    await override('business', businesses.a.businessId, true);

    // Assert
    expect(await isOn(businesses.a.businessId)).toBe(true);
    expect(await isOn(businesses.b.businessId)).toBe(false);
    await clear('business', businesses.a.businessId);
  });

  it("positive control: B's own override turns it on for B and not for A", async () => {
    // Act
    await override('business', businesses.b.businessId, true);

    // Assert
    expect(await isOn(businesses.b.businessId)).toBe(true);
    expect(await isOn(businesses.a.businessId)).toBe(false);
    await clear('business', businesses.b.businessId);
    expect(await isOn(businesses.b.businessId)).toBe(false);
  });

  it("applies a store override to that store only: A1's does not reach A2, nor B's stores", async () => {
    // Arrange
    const [a1, a2] = businesses.a.stores;

    // Act
    await override('store', a1.id, true);

    // Assert
    expect(await isOn(businesses.a.businessId, a1.id)).toBe(true);
    expect(await isOn(businesses.a.businessId, a2.id)).toBe(false);
    expect(await isOn(businesses.a.businessId)).toBe(false);
    expect(await isOn(businesses.b.businessId, businesses.b.stores[0].id)).toBe(false);
    await clear('store', a1.id);
  });

  it("positive control: a store override for A2 reaches A2, and an off store override beats A's business override", async () => {
    // Arrange
    const [a1, a2] = businesses.a.stores;

    // Act
    await override('store', a2.id, true);
    await override('business', businesses.a.businessId, true);
    await override('store', a1.id, false);

    // Assert
    expect(await isOn(businesses.a.businessId, a2.id)).toBe(true);
    expect(await isOn(businesses.a.businessId, a1.id)).toBe(false);
    expect(await isOn(businesses.a.businessId)).toBe(true);
    expect(await isOn(businesses.b.businessId)).toBe(false);
    await clear('store', a1.id);
    await clear('store', a2.id);
    await clear('business', businesses.a.businessId);
  });

  it("refuses another business's store as a business target and the reverse", async () => {
    // Act and Assert
    await expect(override('business', businesses.b.stores[0].id, true)).rejects.toMatchObject({
      code: 'flags.unknown-scope-target',
    });
    await expect(override('store', businesses.b.businessId, true)).rejects.toMatchObject({
      code: 'flags.unknown-scope-target',
    });
  });
});
