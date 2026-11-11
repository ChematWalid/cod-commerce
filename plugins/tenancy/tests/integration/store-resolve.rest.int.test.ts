import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { TransactionalConnection } from '@vendure/core';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProvisionedBusiness } from '../../application/provision-business.service';
import { hostCacheKey } from '../../domain/constants';
import { CustomDomainEntity } from '../../infrastructure/custom-domain.entity';
import { ARCHIVE_STORE, CREATE_STORE, type StoreView } from './admin-api-operations';
import { actAsOwner } from './admin-api-session';
import { provisionBusiness, TEST_REDIS_URL, tenancyTestPlugins, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

const FIELD_SET = ['businessId', 'language', 'logo', 'name', 'primaryHost', 'status', 'storeId'];
const CACHED_HOSTS = [
  'demo.localhost',
  'other.localhost',
  'gone.localhost',
  'paused.localhost',
  'shop.example.test',
  'pending.example.test',
];

describe('store resolution over REST', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: tenancyTestPlugins(1011),
    db: loadPluginTestDbConfig(process.env),
  });
  const probe = new Redis(TEST_REDIS_URL);
  let demo: ProvisionedBusiness;
  let other: ProvisionedBusiness;

  async function get(path: string): Promise<{ status: number; body: unknown }> {
    const { port } = (server.app.getHttpServer() as Server).address() as AddressInfo;
    const response = await fetch(`http://localhost:${String(port)}${path}`);
    return { status: response.status, body: await response.json() };
  }

  const resolve = (host: string): Promise<{ status: number; body: unknown }> =>
    get(`/store/resolve?host=${encodeURIComponent(host)}`);

  async function addCustomDomain(host: string, verifiedAt: Date | null): Promise<void> {
    const domains = server.app.get(TransactionalConnection).rawConnection.getRepository(CustomDomainEntity);
    const id = `${String(Date.now())}${String(domains.metadata.columns.length)}${String(host.length)}`;
    await domains.insert({ id, host, verifiedAt, businessId: demo.business.id, storeId: demo.store.id });
  }

  beforeAll(async () => {
    await probe.del(...CACHED_HOSTS.map(hostCacheKey));
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    demo = await provisionBusiness(server.app, 'demo');
    other = await provisionBusiness(server.app, 'other');
  });

  afterAll(async () => {
    await server.destroy();
    await probe.del(...CACHED_HOSTS.map(hostCacheKey));
    probe.disconnect();
  });

  it('resolves an unusual form of a host to exactly the public fields', async () => {
    // Act
    const { status, body } = await resolve('DEMO.localhost:3001');

    // Assert
    expect(status).toBe(200);
    expect(Object.keys(body as object).sort()).toEqual(FIELD_SET);
    expect(body).toEqual({
      storeId: demo.store.id,
      businessId: demo.business.id,
      language: 'ar',
      name: 'demo store',
      logo: null,
      primaryHost: 'demo.localhost',
      status: 'active',
    });
  });

  it('keeps each business on its own host', async () => {
    // Act
    const { body } = await resolve('other.localhost');

    // Assert
    expect(body).toMatchObject({ storeId: other.store.id, businessId: other.business.id });
  });

  it.each(['nope.localhost', 'localhost', 'a.b.localhost', 'xn--mnchen-3ya.localhost', '[::1]', 'bad host'])(
    'answers 404 for %s',
    async (host) => {
      // Act and Assert
      await expect(resolve(host)).resolves.toMatchObject({ status: 404 });
    },
  );

  it.each([
    ['no parameter', '/store/resolve'],
    ['a repeated parameter', '/store/resolve?host=demo.localhost&host=other.localhost'],
  ])('answers 404, not 400 or 500, for %s', async (_label, path) => {
    // Act and Assert
    await expect(get(path)).resolves.toMatchObject({ status: 404 });
  });

  it('resolves a verified custom domain to its store, with the subdomain as primary host', async () => {
    // Arrange
    await addCustomDomain('shop.example.test', new Date());

    // Act
    const { status, body } = await resolve('shop.example.test');

    // Assert
    expect(status).toBe(200);
    expect(body).toMatchObject({ storeId: demo.store.id, primaryHost: 'demo.localhost' });
  });

  it('answers 404 for a custom domain that is not verified', async () => {
    // Arrange
    await addCustomDomain('pending.example.test', null);

    // Act and Assert
    await expect(resolve('pending.example.test')).resolves.toMatchObject({ status: 404 });
  });

  it('finds a store by id with the same fields as by host', async () => {
    // Act
    const byId = await get(`/store/by-id/${demo.store.id}`);
    const byHost = await resolve('demo.localhost');

    // Assert
    expect(byId.status).toBe(200);
    expect(byId.body).toEqual(byHost.body);
  });

  it.each(['abc', '0', '9223372036854775808', '999999'])('answers 404 for the store id %s', async (id) => {
    // Act and Assert
    await expect(get(`/store/by-id/${id}`)).resolves.toMatchObject({ status: 404 });
  });

  it('answers 404 by host and by id once a store is archived', async () => {
    // Arrange
    await actAsOwner(server.app, adminClient, 'demo', demo.store.channelId);
    const { createStore: created } = await adminClient.query<{ createStore: StoreView }>(CREATE_STORE, {
      input: { name: 'gone store', subdomain: 'gone', language: 'en' },
    });
    await expect(resolve('gone.localhost')).resolves.toMatchObject({ status: 200 });

    // Act
    await adminClient.query(ARCHIVE_STORE, { id: created.id });

    // Assert
    await expect(resolve('gone.localhost')).resolves.toMatchObject({ status: 404 });
    await expect(get(`/store/by-id/${created.id}`)).resolves.toMatchObject({ status: 404 });
  });

  it('answers 404 by host and by id for a store of a suspended business', async () => {
    // Arrange: nothing suspends a business yet, so the row is changed directly, before anything caches the host.
    const paused = await provisionBusiness(server.app, 'paused');
    const raw = server.app.get(TransactionalConnection).rawConnection;
    await raw.query(`UPDATE "business" SET "status" = 'suspended' WHERE "id" = $1`, [paused.business.id]);

    // Act
    const byHost = await resolve('paused.localhost');
    const byId = await get(`/store/by-id/${paused.store.id}`);

    // Assert
    expect(byHost.status).toBe(404);
    expect(byId.status).toBe(404);
  });
});
