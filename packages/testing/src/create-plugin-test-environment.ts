import { CurrencyCode, type InitialData, LanguageCode } from '@vendure/core';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  PostgresInitializer,
  registerInitializer,
  TestServer,
} from '@vendure/testing';
import { buildPluginTestConfig, type PluginTestEnvironmentOptions } from './plugin-test-config';

export type { PluginTestEnvironmentOptions, SharedCacheOptions } from './plugin-test-config';

/** The currency of the channels a plugin test creates: the platform's (ADR 0004). */
export const PLUGIN_TEST_CURRENCY_CODE = CurrencyCode.DZD;

/** The `vendure-token` of the default (platform) channel of a plugin test server. */
export const PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN = E2E_DEFAULT_CHANNEL_TOKEN;

/** The smallest population a plugin test server needs: English, and Algeria as the only country and zone. */
export const PLUGIN_TEST_INITIAL_DATA: InitialData = {
  defaultLanguage: LanguageCode.en,
  defaultZone: 'Algeria',
  taxRates: [{ name: 'Algeria zero rate', percentage: 0 }],
  shippingMethods: [],
  paymentMethods: [],
  countries: [{ name: 'Algeria', code: 'DZ', zone: 'Algeria' }],
  collections: [],
};

// The stock initializer creates one database per test file and builds it with `synchronize: true`. That is
// test-only: the server's RF4 e2e proves the committed migrations match the entities.
registerInitializer('postgres', new PostgresInitializer());

/** A server that joins the database of another server in the same file: `init` only boots it. */
class AttachedTestServer extends TestServer {
  // The stock `init` runs the initializer, which drops and recreates the database the first server owns.
  override init(): Promise<void> {
    return this.bootstrap();
  }
}

/**
 * A Vendure test server and GraphQL clients for a plugin's integration tests: Vendure's `testConfig` on
 * Postgres (one database per test file, created on `db.databaseUrl`) with `plugins` registered. The caller
 * runs `server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, … })` and `server.destroy()`.
 */
export function createPluginTestEnvironment(
  options: PluginTestEnvironmentOptions,
): ReturnType<typeof createTestEnvironment> {
  const config = buildPluginTestConfig(options);
  const environment = createTestEnvironment(config);
  return options.attachToDatabase === undefined
    ? environment
    : { ...environment, server: new AttachedTestServer(config) };
}
