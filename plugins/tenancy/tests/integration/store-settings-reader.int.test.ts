import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { MAX_SNOWFLAKE, toBusinessId, toStoreId } from '@cod/shared';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProvisionedBusiness } from '../../application/provision-business.service';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import { StoreSettingsReader } from '../../domain/ports/store-settings-reader.port';
import { StoreEntity } from '../../infrastructure/store.entity';
import { provisionBusiness, tenancyTestPlugins, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

describe('StoreSettingsReader', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: tenancyTestPlugins(1014),
    db: loadPluginTestDbConfig(process.env),
  });
  let a: ProvisionedBusiness;
  let b: ProvisionedBusiness;
  let archived: ProvisionedBusiness;

  const context = async (): Promise<OperationContext> =>
    asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    a = await provisionBusiness(server.app, 'settings-a');
    b = await provisionBusiness(server.app, 'settings-b');
    archived = await provisionBusiness(server.app, 'settings-archived');
    // Arrange (shared): A hides sold-out products, B keeps the default, the third store is archived.
    const stores = server.app.get(TransactionalConnection).rawConnection.getRepository(StoreEntity);
    await stores.update({ id: a.store.id }, { soldOutBehavior: 'hide' });
    await stores.update({ id: archived.store.id }, { status: 'archived', archivedAt: new Date() });
  });

  afterAll(async () => {
    await server.destroy();
  });

  it("reads sold-out behaviour of the caller's store", async () => {
    // Act
    const settings = await server.app
      .get(StoreSettingsReader)
      .settingsOf(await context(), toBusinessId(a.business.id), a.store.id);

    // Assert
    expect(settings).toEqual({
      soldOutBehavior: 'hide',
      language: 'ar',
      channelId: a.store.channelId,
      status: 'active',
    });
  });

  it('answers null for a store of another business', async () => {
    // Act
    const foreign = await server.app
      .get(StoreSettingsReader)
      .settingsOf(await context(), toBusinessId(a.business.id), b.store.id);
    const own = await server.app
      .get(StoreSettingsReader)
      .settingsOf(await context(), toBusinessId(b.business.id), b.store.id);

    // Assert: the positive control shows B's store exists and keeps the default
    expect(foreign).toBeNull();
    expect(own?.soldOutBehavior).toBe('keep');
  });

  it('reads an archived store with its archived status', async () => {
    // Act
    const settings = await server.app
      .get(StoreSettingsReader)
      .settingsOf(await context(), toBusinessId(archived.business.id), archived.store.id);

    // Assert
    expect(settings).toEqual({
      soldOutBehavior: 'keep',
      language: 'ar',
      channelId: archived.store.channelId,
      status: 'archived',
    });
  });

  it('answers null for a store id that no business uses', async () => {
    // Act
    const missing = await server.app
      .get(StoreSettingsReader)
      .settingsOf(await context(), toBusinessId(a.business.id), toStoreId(MAX_SNOWFLAKE.toString()));

    // Assert
    expect(missing).toBeNull();
  });
});
