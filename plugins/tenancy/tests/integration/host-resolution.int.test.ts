import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { TransactionalConnection } from '@vendure/core';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProvisionedBusiness } from '../../application/provision-business.service';
import { ResolveHostService } from '../../application/resolve-host.service';
import { HOST_CACHE_TTL_SECONDS, hostCacheKey } from '../../domain/constants';
import { HostInvalidationSubscriber } from '../../infrastructure/host-invalidation.subscriber';
import { HostInvalidator } from '../../infrastructure/host-invalidator';
import { LruHostCache } from '../../infrastructure/lru';
import { PlatformStoreLookup } from '../../infrastructure/platform-store-lookup';
import { StoreEntity } from '../../infrastructure/store.entity';
import { ValkeyHostCache } from '../../infrastructure/valkey-host-cache';
import {
  ARCHIVE_STORE,
  CHANGE_STORE_SUBDOMAIN,
  CREATE_STORE,
  type StoreView,
  UPDATE_STORE,
} from './admin-api-operations';
import { actAsOwner, seedAsset } from './admin-api-session';
import { provisionBusiness, TEST_REDIS_URL, tenancyTestPlugins, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

const HOST_PROPAGATION_LIMIT_MS = 1000;
const POLL_MS = 10;
/** Longer than the 500 ms re-delete delay. */
const AFTER_REDELETE_MS = 600;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** One process's resolver stack, on the real Valkey. */
interface Stack {
  readonly resolver: ResolveHostService;
  readonly shared: ValkeyHostCache;
  readonly invalidator: HostInvalidator;
  readonly stop: () => Promise<void>;
}

describe('host to store resolution', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: tenancyTestPlugins(1010),
    db: loadPluginTestDbConfig(process.env),
  });
  const probe = new Redis(TEST_REDIS_URL);
  const stacks: Stack[] = [];
  let alpha: ProvisionedBusiness;

  async function startStack(): Promise<Stack> {
    const lookup = server.app.get(PlatformStoreLookup);
    const local = new LruHostCache();
    const shared = new ValkeyHostCache(new Redis(TEST_REDIS_URL));
    const subscriber = new HostInvalidationSubscriber(new Redis(TEST_REDIS_URL), local);
    await subscriber.start();
    const stack: Stack = {
      resolver: new ResolveHostService({ local, shared, lookup, platformDomain: 'localhost' }),
      shared,
      invalidator: new HostInvalidator(shared, local, lookup, 'localhost'),
      stop: async () => {
        await stack.invalidator.onApplicationShutdown();
        subscriber.onApplicationShutdown();
      },
    };
    stacks.push(stack);
    return stack;
  }

  async function waitUntilGone(stack: Stack, host: string): Promise<void> {
    while ((await stack.resolver.resolve(host)) !== null) await sleep(POLL_MS);
  }

  async function channelOf(storeId: string): Promise<number> {
    const rows = server.app.get(TransactionalConnection).rawConnection.getRepository(StoreEntity);
    return (await rows.findOneByOrFail({ id: storeId })).channelId;
  }

  const clearHosts = (...hosts: string[]): Promise<number> => probe.del(...hosts.map(hostCacheKey));
  const asAlpha = (): Promise<void> => actAsOwner(server.app, adminClient, 'alpha', alpha.store.channelId);

  async function openStore(subdomain: string): Promise<StoreView> {
    await asAlpha();
    const { createStore } = await adminClient.query<{ createStore: StoreView }>(CREATE_STORE, {
      input: { name: `${subdomain} store`, subdomain, language: 'ar' },
    });
    await clearHosts(`${subdomain}.localhost`);
    return createStore;
  }

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    await clearHosts('alpha.localhost');
    alpha = await provisionBusiness(server.app, 'alpha');
  });

  afterAll(async () => {
    await Promise.all(stacks.map((stack) => stack.stop()));
    await server.destroy();
    probe.disconnect();
  });

  it('stops resolving the old host on every process within a second of a subdomain change', async () => {
    // Arrange
    const created = await openStore('moving');
    await clearHosts('moved.localhost');
    const [one, two] = [await startStack(), await startStack()];
    await expect(one.resolver.resolve('moving.localhost')).resolves.toMatchObject({ storeId: created.id });
    await expect(two.resolver.resolve('moving.localhost')).resolves.toMatchObject({ storeId: created.id });

    // Act
    const started = Date.now();
    await adminClient.query(CHANGE_STORE_SUBDOMAIN, { id: created.id, subdomain: 'moved' });
    await Promise.all([waitUntilGone(one, 'moving.localhost'), waitUntilGone(two, 'moving.localhost')]);
    const elapsed = Date.now() - started;

    // Assert
    expect(elapsed).toBeLessThan(HOST_PROPAGATION_LIMIT_MS);
    await expect(one.resolver.resolve('moved.localhost')).resolves.toMatchObject({ storeId: created.id });
    await expect(two.resolver.resolve('moved.localhost')).resolves.toMatchObject({ storeId: created.id });
    await clearHosts('moved.localhost');
  });

  it('removes an old value that a slow resolver writes after the invalidation', async () => {
    // Arrange
    await clearHosts('stale.localhost');
    const stack = await startStack();
    const value = {
      storeId: '100',
      businessId: '200',
      language: 'ar',
      name: 'Stale',
      logo: null,
      primaryHost: 'stale.localhost',
      status: 'active',
    } as const;
    await stack.invalidator.invalidateHosts(['stale.localhost']);

    // Act: the resolver read the row before the commit and writes only now.
    await stack.shared.set('stale.localhost', value);
    await sleep(AFTER_REDELETE_MS);

    // Assert
    expect(await probe.exists(hostCacheKey('stale.localhost'))).toBe(0);
    await expect(stack.resolver.resolve('stale.localhost')).resolves.toBeNull();
  });

  it('writes a host key with the backstop TTL', async () => {
    // Arrange
    await clearHosts('ttl.localhost');
    const stack = await startStack();

    // Act
    await stack.shared.set('ttl.localhost', {
      storeId: '100',
      businessId: '200',
      language: 'ar',
      name: 'Ttl',
      logo: null,
      primaryHost: 'ttl.localhost',
      status: 'active',
    });

    // Assert
    const ttl = await probe.ttl(hostCacheKey('ttl.localhost'));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(HOST_CACHE_TTL_SECONDS);
    await clearHosts('ttl.localhost');
  });

  it('stops resolving an archived store while its subdomain stays taken', async () => {
    // Arrange
    const created = await openStore('closing');
    const stack = await startStack();
    await expect(stack.resolver.resolve('closing.localhost')).resolves.not.toBeNull();

    // Act
    await adminClient.query(ARCHIVE_STORE, { id: created.id });
    await waitUntilGone(stack, 'closing.localhost');

    // Assert
    await expect(stack.resolver.resolve('closing.localhost')).resolves.toBeNull();
    await expect(stack.resolver.findById(created.id)).resolves.toBeNull();
  });

  it('forgets the old name, language and logo when a store changes them', async () => {
    // Arrange
    const created = await openStore('changing');
    const stack = await startStack();
    await expect(stack.resolver.resolve('changing.localhost')).resolves.toMatchObject({ name: 'changing store' });
    const logoAssetId = await seedAsset(server.app, await channelOf(created.id));
    await asAlpha();

    // Act
    await adminClient.query(UPDATE_STORE, {
      id: created.id,
      input: { name: 'Renamed', language: 'fr', logoAssetId },
    });
    await sleep(POLL_MS * 5);

    // Assert
    const after = await stack.resolver.resolve('changing.localhost');
    expect(after).toMatchObject({ name: 'Renamed', language: 'fr', logo: expect.any(String) as string });
    await clearHosts('changing.localhost');
  });
});
