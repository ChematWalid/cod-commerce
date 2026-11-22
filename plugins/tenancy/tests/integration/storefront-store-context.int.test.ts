import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProvisionedBusiness } from '../../application/provision-business.service';
import { SIGNED_STORE_TEST_HEADER, STOREFRONT_PROBE_ROUTE, StorefrontProbePlugin } from './storefront-probe.plugin';
import { provisionBusiness, tenancyTestPlugins, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

describe('storefront store context', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [...tenancyTestPlugins(986), StorefrontProbePlugin],
    db: loadPluginTestDbConfig(process.env),
  });
  let alpha: ProvisionedBusiness;
  let bravo: ProvisionedBusiness;
  let paused: ProvisionedBusiness;

  async function probe(signedStoreId?: string): Promise<{ status: number; text: string }> {
    const { port } = (server.app.getHttpServer() as Server).address() as AddressInfo;
    const headers: Record<string, string> =
      signedStoreId === undefined ? {} : { [SIGNED_STORE_TEST_HEADER]: signedStoreId };
    const response = await fetch(`http://localhost:${String(port)}/${STOREFRONT_PROBE_ROUTE}`, { headers });
    return { status: response.status, text: await response.text() };
  }

  const sql = (statement: string, parameters: unknown[]): Promise<unknown> =>
    server.app.get(TransactionalConnection).rawConnection.query(statement, parameters);

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    alpha = await provisionBusiness(server.app, 'sf-alpha');
    bravo = await provisionBusiness(server.app, 'sf-bravo');
    paused = await provisionBusiness(server.app, 'sf-paused');
    await sql(`UPDATE "store" SET "status" = 'archived', "archivedAt" = now() WHERE "id" = $1`, [bravo.store.id]);
    await sql(`UPDATE "business" SET "status" = 'suspended' WHERE "id" = $1`, [paused.business.id]);
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('runs a call signed for store A on A’s channel, as a shop call, with A as the only tenant store', async () => {
    // Act
    const { status, text } = await probe(alpha.store.id);

    // Assert
    expect(status).toBe(200);
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(body).toMatchObject({
      channelId: alpha.store.channelId,
      apiType: 'shop',
      tenant: { businessId: alpha.business.id, storeIds: [alpha.store.id], activeStoreId: alpha.store.id },
      store: {
        storeId: alpha.store.id,
        businessId: alpha.business.id,
        channelId: alpha.store.channelId,
        soldOutBehavior: 'keep',
        language: 'ar',
      },
    });
    expect(body['copiedTenant']).toEqual(body['tenant']);
  });

  it.each([
    ['no signature', undefined],
    ['an archived store of business B', 'bravo'],
    ['a store of a suspended business', 'paused'],
    ['an unknown store id', '7340032999999999'],
    ['a malformed store id', '1 OR 1=1'],
  ])('answers 404 with an empty body for %s', async (_label, which) => {
    // Arrange
    const ids: Record<string, string> = { bravo: bravo.store.id, paused: paused.store.id };
    const storeId = which === undefined ? undefined : (ids[which] ?? which);

    // Act
    const { status, text } = await probe(storeId);

    // Assert
    expect(status).toBe(404);
    expect(text).toBe('');
  });
});
