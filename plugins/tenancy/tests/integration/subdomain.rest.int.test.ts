import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TenancyPlugin } from '../../tenancy.plugin';
import { provisionBusiness, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

describe('GET /stores/subdomain-availability', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [TenancyPlugin.init({ redisUrl: 'redis://unused', platformDomain: 'localhost', snowflakeWorkerId: 1002 })],
    db: loadPluginTestDbConfig(process.env),
  });

  async function get(query: string): Promise<{ status: number; body: unknown }> {
    const { port } = (server.app.getHttpServer() as Server).address() as AddressInfo;
    const response = await fetch(`http://localhost:${String(port)}/stores/subdomain-availability${query}`);
    return { status: response.status, body: await response.json() };
  }

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    await provisionBusiness(server.app, 'demo');
  });

  afterAll(async () => {
    await server.destroy();
  });

  it.each([
    ['demo', { subdomain: 'demo', status: 'taken' }],
    ['DEMO', { subdomain: 'demo', status: 'taken' }],
    ['www', { subdomain: 'www', status: 'reserved' }],
    ['free-name', { subdomain: 'free-name', status: 'available', reason: null }],
  ])('answers anonymously for %s', async (subdomain, expected) => {
    // Act
    const { status, body } = await get(`?subdomain=${subdomain}`);

    // Assert
    expect(status).toBe(200);
    expect(body).toMatchObject(expected);
  });

  it('explains why a subdomain is invalid', async () => {
    // Act
    const { body } = await get('?subdomain=a');

    // Assert
    expect(body).toMatchObject({ subdomain: 'a', status: 'invalid', reason: expect.any(String) as string });
  });

  it.each([
    ['', 'no parameter'],
    ['?subdomain=one&subdomain=two', 'a repeated parameter'],
  ])('answers invalid, not a server error, for %s (%s)', async (query) => {
    // Act
    const { status, body } = await get(query);

    // Assert
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'invalid' });
  });
});
