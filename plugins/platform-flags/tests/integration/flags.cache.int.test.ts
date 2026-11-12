import { PLATFORM_CLOCK } from '@cod/plugin-platform-jobs';
import { FLAG_KEYS } from '@cod/shared';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FeatureFlags } from '../../application/feature-flags.service';
import { FlagAdminService } from '../../application/flag-admin.service';
import { FlagSeedService } from '../../application/flag-seed.service';
import type { FeatureFlagsPorts, FlagAdminPorts, FlagLogger } from '../../application/ports';
import { FLAG_ADMIN_PORTS, FLAG_PORTS, FLAG_STORE } from '../../application/tokens';
import { FLAG_SNAPSHOT_TTL_MS } from '../../domain/constants';
import type { FlagStorePort } from '../../domain/ports/flag-store.port';
import { ValkeyFlagCache } from '../../infrastructure/valkey-flag-cache';
import { ManualClock } from '../fixtures/manual-clock';
import { clearFlagKeys, CLOSED_REDIS_URL, createFlagsTestEnvironment, FLAGS_REDIS_URL } from './flags-kit';

const SNOWFLAKE_WORKER_ID = 1021;
const APP_ENV = 'test-platform-flags-cache';
const KEY = FLAG_KEYS.capi;
const ACTOR = 'cache-test';
const PUBSUB_BUDGET_MS = 1000;
const READY_WAIT_MS = 3000;

const silent: FlagLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

describe('flag snapshot cache (Review Focus 5)', () => {
  const clockA = new ManualClock();
  const { server } = createFlagsTestEnvironment(SNOWFLAKE_WORKER_ID, APP_ENV, clockA);
  const caches: ValkeyFlagCache[] = [];
  let ports: FeatureFlagsPorts;
  let adminPorts: FlagAdminPorts;
  let store: FlagStorePort;

  /** A second process: its own Valkey client, subscriber, snapshot and clock, on the same database. */
  const secondProcess = (redisUrl: string, clock: ManualClock): { flags: FeatureFlags; cache: ValkeyFlagCache } => {
    const cache = new ValkeyFlagCache({ redisUrl, appEnv: APP_ENV, clock, logger: silent });
    caches.push(cache);
    const flags = new FeatureFlags({ ...ports, cache, clock });
    cache.subscribe(() => {
      flags.forget();
    });
    return { flags, cache };
  };

  const adminOver = (cache: ValkeyFlagCache): FlagAdminService => {
    const flags = new FeatureFlags({ ...ports, cache });
    return new FlagAdminService({ ...adminPorts, cache }, flags);
  };

  const isOn = (flags: FeatureFlags): Promise<boolean> => flags.isEnabledFor({}, KEY);

  beforeAll(async () => {
    await clearFlagKeys(APP_ENV);
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    ports = server.app.get<FeatureFlagsPorts>(FLAG_PORTS);
    adminPorts = server.app.get<FlagAdminPorts>(FLAG_ADMIN_PORTS);
    store = server.app.get<FlagStorePort>(FLAG_STORE);
    expect(server.app.get(PLATFORM_CLOCK)).toBe(clockA);
    await server.app.get(FlagSeedService).converge();
  }, 120_000);

  afterAll(async () => {
    await Promise.all(caches.map((cache) => cache.close()));
    await server.destroy();
    await clearFlagKeys(APP_ENV);
  });

  it("shows B a change made through A's admin service within one second, by pub/sub", async () => {
    // Arrange
    const clockB = new ManualClock(clockA.now());
    const b = secondProcess(FLAGS_REDIS_URL, clockB);
    await b.cache.whenReady(READY_WAIT_MS);
    expect(await isOn(b.flags)).toBe(true);
    const admin = server.app.get(FlagAdminService);

    // Act
    await admin.update(ACTOR, { key: KEY, defaultEnabled: false });

    // Assert: B's own snapshot is 0 ms old on a clock nobody moves, so only the notice can have changed its answer.
    await vi.waitFor(
      async () => {
        expect(await isOn(b.flags)).toBe(false);
      },
      { timeout: PUBSUB_BUDGET_MS, interval: 25 },
    );
    await admin.update(ACTOR, { key: KEY, defaultEnabled: true });
    await vi.waitFor(
      async () => {
        expect(await isOn(b.flags)).toBe(true);
      },
      { timeout: PUBSUB_BUDGET_MS, interval: 25 },
    );
  });

  it('serves a second process from the shared snapshot without reading the database', async () => {
    // Arrange
    const first = secondProcess(FLAGS_REDIS_URL, new ManualClock());
    await first.cache.whenReady(READY_WAIT_MS);
    await isOn(first.flags);
    const second = secondProcess(FLAGS_REDIS_URL, new ManualClock());
    await second.cache.whenReady(READY_WAIT_MS);
    const load = vi.spyOn(store, 'loadSnapshot');

    // Act
    const answer = await isOn(second.flags);

    // Assert
    expect(answer).toBe(true);
    expect(load).not.toHaveBeenCalled();
    load.mockRestore();
  });

  describe('with Valkey down', () => {
    it("still answers from the database, commits a change, and shows it once the snapshot is 30 s old", async () => {
      // Arrange
      const clockB = new ManualClock();
      const b = secondProcess(CLOSED_REDIS_URL, clockB);
      const down = secondProcess(CLOSED_REDIS_URL, new ManualClock());
      expect(await isOn(b.flags)).toBe(true);

      // Act: the change goes through an admin whose own Valkey is down too.
      const view = await adminOver(down.cache).update(ACTOR, { key: KEY, defaultEnabled: false });
      const meanwhile = await isOn(b.flags);
      clockB.advance(FLAG_SNAPSHOT_TTL_MS - 1);
      const justBefore = await isOn(b.flags);
      clockB.advance(1);
      const afterTtl = await isOn(b.flags);

      // Assert
      expect(view.defaultEnabled).toBe(false);
      expect((await store.loadSnapshot()).flags[KEY]?.defaultEnabled).toBe(false);
      expect(meanwhile).toBe(true);
      expect(justBefore).toBe(true);
      expect(afterTtl).toBe(false);
      await server.app.get(FlagAdminService).update(ACTOR, { key: KEY, defaultEnabled: true });
    });

    it('answers from the database on the first question, with nothing cached anywhere', async () => {
      // Arrange
      await clearFlagKeys(APP_ENV);
      const b = secondProcess(CLOSED_REDIS_URL, new ManualClock());

      // Act and Assert
      expect(await isOn(b.flags)).toBe(true);
    });
  });
});
