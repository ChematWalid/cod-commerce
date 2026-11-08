import { toPostgresFields } from '@cod/shared';
import { CurrencyCode, type InitialData, LanguageCode, type VendureConfig } from '@vendure/core';
import {
  createTestEnvironment,
  E2E_DEFAULT_CHANNEL_TOKEN,
  PostgresInitializer,
  registerInitializer,
  testConfig,
} from '@vendure/testing';
import type { PluginTestDbConfig } from './plugin-test-db-config';

/** What {@link createPluginTestEnvironment} boots. */
export interface PluginTestEnvironmentOptions {
  /** The plugins under test (classes, or the modules their `init` returns), added to Vendure's `testConfig`. */
  readonly plugins: NonNullable<VendureConfig['plugins']>;
  readonly db: PluginTestDbConfig;
  /** The most connections the server's pool opens; the driver's default (10) when omitted. */
  readonly poolSize?: number;
}

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

/**
 * A Vendure test server and GraphQL clients for a plugin's integration tests: Vendure's `testConfig` on
 * Postgres (one database per test file, created on `db.databaseUrl`) with `plugins` registered. The caller
 * runs `server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, … })` and `server.destroy()`.
 */
export function createPluginTestEnvironment(
  options: PluginTestEnvironmentOptions,
): ReturnType<typeof createTestEnvironment> {
  const config: Required<VendureConfig> = {
    ...testConfig,
    // Replaced, not merged: `testConfig`'s sql.js options must not leak into the Postgres connection.
    dbConnectionOptions: {
      type: 'postgres',
      ...toPostgresFields(options.db.databaseUrl),
      synchronize: true,
      logging: false,
      ...(options.poolSize === undefined ? {} : { extra: { max: options.poolSize } }),
    },
    plugins: [...testConfig.plugins, ...options.plugins],
  };
  return createTestEnvironment(config);
}
