import { FLAG_KEYS, FLAG_SEEDS } from '@cod/shared';
import {
  adminOperationsOf,
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminApiSchema } from '../../api/schema';
import { FlagSeedService } from '../../application/flag-seed.service';
import {
  clearFlagKeys,
  createFlagsTestEnvironment,
  declaredOperations,
  EVALUATE,
  FEATURE_FLAGS,
  type FlagResult,
  REMOVE_OVERRIDE,
  SET_OVERRIDE,
  sqlOf,
  STAFF_ONLY,
  UPDATE_FEATURE_FLAG,
} from './flags-kit';

const SNOWFLAKE_WORKER_ID = 1019;
const APP_ENV = 'test-platform-flags-api';
const AI = FLAG_KEYS.ai;

describe('flags Admin API', () => {
  const { server, adminClient } = createFlagsTestEnvironment(SNOWFLAKE_WORKER_ID, APP_ENV);
  const sql = sqlOf(server);
  let businesses: TwoBusinesses;

  const asSuperAdmin = async (): Promise<void> => {
    await adminClient.asSuperAdmin();
  };

  const flagsListed = async (): Promise<FlagResult[]> => {
    const { featureFlags } = await adminClient.query<{ featureFlags: FlagResult[] }>(FEATURE_FLAGS);
    return featureFlags;
  };

  const evaluate = async (businessId?: string, storeId?: string): Promise<boolean> => {
    const { evaluateFeatureFlag } = await adminClient.query<{ evaluateFeatureFlag: boolean }>(EVALUATE, {
      key: AI,
      businessId,
      storeId,
    });
    return evaluateFeatureFlag;
  };

  beforeAll(async () => {
    await clearFlagKeys(APP_ENV);
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
    await clearFlagKeys(APP_ENV);
  });

  describe('seeds', () => {
    it('are inserted by converge, once, and a staff change survives the next converge', async () => {
      // Arrange
      const seeds = server.app.get(FlagSeedService);
      expect(await sql(`SELECT 1 FROM "feature_flag"`)).toHaveLength(0);

      // Act
      const first = await seeds.converge();
      await asSuperAdmin();
      await adminClient.query(UPDATE_FEATURE_FLAG, { input: { key: AI, defaultEnabled: false, rolloutPercent: 40 } });
      const second = await seeds.converge();

      // Assert
      expect(first.inserted).toBe(FLAG_SEEDS.length);
      expect(second.inserted).toBe(0);
      const rows = await sql(`SELECT "key", "defaultEnabled", "rolloutPercent" FROM "feature_flag" ORDER BY "key"`);
      expect(rows.map((row) => row['key'])).toEqual(FLAG_SEEDS.map((seed) => seed.key).sort());
      expect(rows.find((row) => row['key'] === AI)).toMatchObject({ defaultEnabled: false, rolloutPercent: 40 });
      expect(rows.find((row) => row['key'] === FLAG_KEYS.capi)).toMatchObject({
        defaultEnabled: true,
        rolloutPercent: 100,
      });
    });
  });

  describe('as platform staff', () => {
    beforeAll(async () => {
      await asSuperAdmin();
      await adminClient.query(UPDATE_FEATURE_FLAG, {
        input: { key: AI, defaultEnabled: false, rolloutPercent: 100 },
      });
    });

    it('lists the four seeded flags with their overrides', async () => {
      // Act
      const flags = await flagsListed();

      // Assert
      expect(flags.map((flag) => flag.key)).toEqual(FLAG_SEEDS.map((seed) => seed.key).sort());
      expect(flags.find((flag) => flag.key === AI)).toMatchObject({ defaultEnabled: false, overrides: [] });
    });

    it('updates the default, the rollout and the description', async () => {
      // Act
      const { updateFeatureFlag } = await adminClient.query<{ updateFeatureFlag: FlagResult }>(UPDATE_FEATURE_FLAG, {
        input: { key: FLAG_KEYS.capi, rolloutPercent: 30, description: 'Conversion events (test)' },
      });
      await adminClient.query(UPDATE_FEATURE_FLAG, { input: { key: FLAG_KEYS.capi, rolloutPercent: 100 } });

      // Assert
      expect(updateFeatureFlag).toMatchObject({
        key: FLAG_KEYS.capi,
        defaultEnabled: true,
        rolloutPercent: 30,
        description: 'Conversion events (test)',
      });
    });

    it('sets and removes a business override and a store override, and evaluates them', async () => {
      // Arrange
      const businessId = businesses.a.businessId;
      const storeId = businesses.a.stores[0].id;
      expect(await evaluate(businessId, storeId)).toBe(false);

      // Act
      const { setFeatureFlagOverride: withBusiness } = await adminClient.query<{
        setFeatureFlagOverride: FlagResult;
      }>(SET_OVERRIDE, { input: { key: AI, scope: 'BUSINESS', scopeId: businessId, enabled: true } });
      const onForBusiness = await evaluate(businessId);
      const { setFeatureFlagOverride: withStore } = await adminClient.query<{ setFeatureFlagOverride: FlagResult }>(
        SET_OVERRIDE,
        { input: { key: AI, scope: 'STORE', scopeId: storeId, enabled: false } },
      );
      const offForStore = await evaluate(businessId, storeId);
      await adminClient.query(REMOVE_OVERRIDE, { input: { key: AI, scope: 'STORE', scopeId: storeId } });
      const { removeFeatureFlagOverride: afterRemoval } = await adminClient.query<{
        removeFeatureFlagOverride: FlagResult;
      }>(REMOVE_OVERRIDE, { input: { key: AI, scope: 'BUSINESS', scopeId: businessId } });

      // Assert
      expect(withBusiness.overrides).toEqual([{ scope: 'BUSINESS', scopeId: businessId, enabled: true }]);
      expect(onForBusiness).toBe(true);
      expect(withStore.overrides).toHaveLength(2);
      expect(offForStore).toBe(false);
      expect(afterRemoval.overrides).toEqual([]);
      expect(await evaluate(businessId)).toBe(false);
    });

    it('replaces an override for the same target instead of adding a second', async () => {
      // Arrange
      const input = { key: AI, scope: 'BUSINESS', scopeId: businesses.b.businessId };

      // Act
      await adminClient.query(SET_OVERRIDE, { input: { ...input, enabled: true } });
      const { setFeatureFlagOverride } = await adminClient.query<{ setFeatureFlagOverride: FlagResult }>(SET_OVERRIDE, {
        input: { ...input, enabled: false },
      });
      await adminClient.query(REMOVE_OVERRIDE, { input });

      // Assert
      expect(setFeatureFlagOverride.overrides).toEqual([
        { scope: input.scope, scopeId: input.scopeId, enabled: false },
      ]);
    });

    it('takes a plan override with any plan key, which changes nothing until plans exist', async () => {
      // Act
      await adminClient.query(SET_OVERRIDE, { input: { key: AI, scope: 'PLAN', scopeId: 'pro', enabled: true } });
      const answer = await evaluate(businesses.a.businessId);
      await adminClient.query(REMOVE_OVERRIDE, { input: { key: AI, scope: 'PLAN', scopeId: 'pro' } });

      // Assert
      expect(answer).toBe(false);
    });

    it('answers flags.unknown-key for a key that is not a flag, on every operation that takes one', async () => {
      // Act and Assert
      const update = await failureOf(adminClient.query(UPDATE_FEATURE_FLAG, { input: { key: 'nope.enabled' } }));
      const set = await failureOf(
        adminClient.query(SET_OVERRIDE, {
          input: { key: 'nope.enabled', scope: 'PLAN', scopeId: 'pro', enabled: true },
        }),
      );
      const remove = await failureOf(
        adminClient.query(REMOVE_OVERRIDE, { input: { key: 'nope.enabled', scope: 'PLAN', scopeId: 'pro' } }),
      );
      const evaluated = await failureOf(adminClient.query(EVALUATE, { key: 'nope.enabled' }));
      expect([update, set, remove, evaluated].map((failure) => failure.codes)).toEqual([
        ['flags.unknown-key'],
        ['flags.unknown-key'],
        ['flags.unknown-key'],
        ['flags.unknown-key'],
      ]);
    });

    it('answers flags.invalid-rollout for a percent outside 0 to 100', async () => {
      // Act and Assert
      for (const rolloutPercent of [101, -1]) {
        const failure = await failureOf(adminClient.query(UPDATE_FEATURE_FLAG, { input: { key: AI, rolloutPercent } }));
        expect(failure.codes).toEqual(['flags.invalid-rollout']);
      }
      expect((await flagsListed()).find((flag) => flag.key === AI)?.rolloutPercent).toBe(100);
    });

    it('answers flags.unknown-scope-target for a business or store that does not exist, and stores nothing', async () => {
      // Arrange
      const missing = '7999999999999999999';

      // Act and Assert
      for (const [scope, scopeId] of [
        ['BUSINESS', missing],
        ['STORE', missing],
        ['BUSINESS', 'not-an-id'],
        ['STORE', businesses.a.businessId],
        ['BUSINESS', businesses.a.stores[0].id],
      ] as const) {
        const failure = await failureOf(
          adminClient.query(SET_OVERRIDE, { input: { key: AI, scope, scopeId, enabled: true } }),
        );
        expect(failure.codes, `${scope} ${scopeId}`).toEqual(['flags.unknown-scope-target']);
      }
      expect(await sql(`SELECT 1 FROM "feature_flag_override"`)).toHaveLength(0);
    });
  });

  describe('as a merchant owner', () => {
    const operations: Record<string, () => Promise<unknown>> = {
      featureFlags: () => adminClient.query(FEATURE_FLAGS),
      evaluateFeatureFlag: () => adminClient.query(EVALUATE, { key: AI }),
      updateFeatureFlag: () => adminClient.query(UPDATE_FEATURE_FLAG, { input: { key: AI, defaultEnabled: true } }),
      setFeatureFlagOverride: () =>
        adminClient.query(SET_OVERRIDE, {
          input: { key: AI, scope: 'BUSINESS', scopeId: businesses.a.businessId, enabled: true },
        }),
      removeFeatureFlagOverride: () =>
        adminClient.query(REMOVE_OVERRIDE, {
          input: { key: AI, scope: 'BUSINESS', scopeId: businesses.a.businessId },
        }),
    };

    it('is refused with FORBIDDEN on every operation of the schema', async () => {
      // Arrange
      expect(Object.keys(operations).sort()).toEqual(adminOperationsOf(adminApiSchema));
      adminClient.setChannelToken(businesses.a.stores[0].channelToken);
      await adminClient.asUserWithCredentials(businesses.a.owner.email, businesses.a.owner.password);

      // Act and Assert
      for (const [name, call] of Object.entries(operations)) {
        const failure = await failureOf(call());
        expect(failure.codes, name).toEqual(['FORBIDDEN']);
      }
      await asSuperAdmin();
      expect((await flagsListed()).find((flag) => flag.key === AI)).toMatchObject({
        defaultEnabled: false,
        overrides: [],
      });
    });

    it('is refused by the declaration too: every handler holds the PlatformStaff permission and nothing else', () => {
      // Act
      const declared = declaredOperations();

      // Assert
      expect(declared.map((handler) => handler.key).sort()).toEqual(adminOperationsOf(adminApiSchema));
      for (const handler of declared) expect(handler, handler.key).toMatchObject({ allow: STAFF_ONLY });
    });
  });
});
