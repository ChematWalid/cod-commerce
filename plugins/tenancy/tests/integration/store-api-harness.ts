import {
  createPluginTestEnvironment,
  loadPluginTestDbConfig,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
} from '@cod/testing';
import { Channel, TransactionalConnection } from '@vendure/core';
import type { ObjectLiteral, Repository } from 'typeorm';
import { afterAll, afterEach, beforeAll } from 'vitest';
import type { ProvisionedBusiness } from '../../application/provision-business.service';
import { StoreEntity } from '../../infrastructure/store.entity';
import { CREATE_STORE, type StoreView } from './admin-api-operations';
import { actAsOwner } from './admin-api-session';
import { provisionBusiness, tenancyTestPlugins, UPDATE_GLOBAL_LANGUAGES } from './tenant-fixtures';

type TestEnvironment = ReturnType<typeof createPluginTestEnvironment>;

/** What a store API test works with. `alpha` and `bravo` are set once the server has started. */
export interface StoreApi {
  readonly server: TestEnvironment['server'];
  readonly adminClient: TestEnvironment['adminClient'];
  alpha: ProvisionedBusiness;
  bravo: ProvisionedBusiness;
  readonly asAlpha: () => Promise<void>;
  readonly rows: () => Repository<StoreEntity>;
  readonly channels: () => Repository<Channel>;
  readonly sellers: () => Repository<ObjectLiteral>;
  readonly createStore: (subdomain: string) => Promise<StoreView>;
}

/** Starts a server with businesses `alpha` and `bravo`, one store each, and resets the client after every test. */
export function useStoreApi(snowflakeWorkerId: number): StoreApi {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: tenancyTestPlugins(snowflakeWorkerId),
    db: loadPluginTestDbConfig(process.env),
  });
  const raw = () => server.app.get(TransactionalConnection).rawConnection;
  const api: StoreApi = {
    server,
    adminClient,
    alpha: undefined as unknown as ProvisionedBusiness,
    bravo: undefined as unknown as ProvisionedBusiness,
    asAlpha: (): Promise<void> => actAsOwner(server.app, adminClient, 'alpha', api.alpha.store.channelId),
    rows: () => raw().getRepository(StoreEntity),
    channels: () => raw().getRepository(Channel),
    sellers: () => raw().getRepository('Seller'),
    createStore: async (subdomain: string): Promise<StoreView> => {
      const { createStore: store } = await adminClient.query<{ createStore: StoreView }>(CREATE_STORE, {
        input: { name: `${subdomain} store`, subdomain, language: 'ar' },
      });
      return store;
    },
  };

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    api.alpha = await provisionBusiness(server.app, 'alpha');
    api.bravo = await provisionBusiness(server.app, 'bravo');
  });

  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  return api;
}
