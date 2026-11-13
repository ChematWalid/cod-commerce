import { toPostgresFields } from '@cod/shared';
import { DefaultSessionCacheStrategy, RedisCachePlugin, type VendureConfig } from '@vendure/core';
import { testConfig } from '@vendure/testing';
import type { PluginTestDbConfig } from './plugin-test-db-config';

/** A Valkey cache that several test servers share, as the server's processes do in production. */
export interface SharedCacheOptions {
  /** A `redis://host:port[/db]` URL. */
  readonly redisUrl: string;
  /** The key prefix; unique per test file, so files sharing one Valkey never read each other's sessions. */
  readonly namespace: string;
}

/** What a plugin test server boots. */
export interface PluginTestEnvironmentOptions {
  /** The plugins under test (classes, or the modules their `init` returns), added to Vendure's `testConfig`. */
  readonly plugins: NonNullable<VendureConfig['plugins']>;
  readonly db: PluginTestDbConfig;
  /** The most connections the server's pool opens; the driver's default (10) when omitted. */
  readonly poolSize?: number;
  /** The HTTP port; `testConfig`'s (3050) when omitted. A second server in the same file needs another one. */
  readonly port?: number;
  /**
   * The database of a server already running in this file. The server then joins it as is: no schema sync,
   * no drop, no population, and `server.init` only boots it. Without it, the initializer creates a database.
   */
  readonly attachToDatabase?: string;
  /** Keeps Vendure's cache, and so its sessions, in Valkey instead of in this process. */
  readonly sharedCache?: SharedCacheOptions;
}

const DEFAULT_REDIS_PORT = 6379;

function redisOptionsOf(url: string): { host: string; port: number; db?: number } {
  const parsed = new URL(url);
  const db = parsed.pathname.replace(/^\//, '');
  const port = parsed.port === '' ? DEFAULT_REDIS_PORT : Number(parsed.port);
  return { host: parsed.hostname, port, ...(db === '' ? {} : { db: Number(db) }) };
}

function dbConnectionOptionsOf(options: PluginTestEnvironmentOptions): VendureConfig['dbConnectionOptions'] {
  const attached =
    options.attachToDatabase === undefined ? {} : { database: options.attachToDatabase, dropSchema: false };
  return {
    type: 'postgres',
    ...toPostgresFields(options.db.databaseUrl),
    ...attached,
    synchronize: options.attachToDatabase === undefined,
    logging: false,
    ...(options.poolSize === undefined ? {} : { extra: { max: options.poolSize } }),
  };
}

function cachePluginsOf(sharedCache: SharedCacheOptions | undefined): NonNullable<VendureConfig['plugins']> {
  if (sharedCache === undefined) {
    return [];
  }
  return [
    RedisCachePlugin.init({ redisOptions: redisOptionsOf(sharedCache.redisUrl), namespace: sharedCache.namespace }),
  ];
}

/**
 * The Vendure config of a plugin test server: `testConfig` on Postgres with `options.plugins`.
 *
 * Every server gets its own session cache strategy: Vendure re-initialises a shared strategy instance with
 * the last server's cache, which would let two servers in one process share sessions through memory.
 */
export function buildPluginTestConfig(options: PluginTestEnvironmentOptions): Required<VendureConfig> {
  return {
    ...testConfig,
    apiOptions: { ...testConfig.apiOptions, port: options.port ?? testConfig.apiOptions.port },
    authOptions: { ...testConfig.authOptions, sessionCacheStrategy: new DefaultSessionCacheStrategy() },
    // Replaced, not merged: `testConfig`'s sql.js options must not leak into the Postgres connection.
    dbConnectionOptions: dbConnectionOptionsOf(options),
    plugins: [...testConfig.plugins, ...cachePluginsOf(options.sharedCache), ...options.plugins],
  };
}
