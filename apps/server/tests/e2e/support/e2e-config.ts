import { toPostgresFields } from '@cod/shared';
import {
  DefaultLogger,
  type InitialData,
  LanguageCode,
  LogLevel,
  mergeConfig,
  type VendureConfig,
} from '@vendure/core';
import { BullMQJobQueuePlugin } from '@vendure/job-queue-plugin/package/bullmq';
import { PostgresInitializer, registerInitializer, testConfig } from '@vendure/testing';
import { Redis } from 'ioredis';
import { buildDbConfig } from '../../../src/config/db.config';
import { type AppEnv, loadEnv, type ServerRole } from '../../../src/config/env';
import { bullMqOptions, redisOptionsFromUrl } from '../../../src/config/redis.config';
import { buildVendureConfig } from '../../../src/config/vendure-config';

/** The one BullMQ queue that holds every Vendure queue (`@vendure/job-queue-plugin`'s `QUEUE_NAME`). */
export const VENDURE_BULLMQ_QUEUE = 'vendure-job-queue';

/** How many keys one `SCAN` step asks for while removing a test prefix. */
const SCAN_BATCH = 500;

/** The e2e roles: the api boots through `createTestEnvironment`, the worker through `bootstrapWorker`. */
export type E2eRole = Extract<ServerRole, 'api' | 'worker'>;

/** How one e2e file builds its config. */
export interface E2eConfigOptions {
  /** The file's short name; its BullMQ keys live under {@link e2eBullPrefix}. */
  readonly suite: string;
  /** The api port of this file (see `ports.ts`). */
  readonly port: number;
  /** Variables that replace the shell's (or `.env`'s) for this file, e.g. an unreachable `REDIS_URL`. */
  readonly env?: NodeJS.ProcessEnv;
  /** Defaults to `api`. */
  readonly role?: E2eRole;
}

type InitializerOptions = Parameters<PostgresInitializer['init']>[1];

/**
 * The stock initializer forces `synchronize: true`, which would hide a missing migration. B8: the e2e
 * database is built by the committed migrations only (`migrationsRun` at boot).
 */
class MigratedPostgresInitializer extends PostgresInitializer {
  override async init(testFileName: string, connectionOptions: InitializerOptions): Promise<InitializerOptions> {
    const options = await super.init(testFileName, connectionOptions);
    return Object.assign(options, { synchronize: false });
  }
}

registerInitializer('postgres', new MigratedPostgresInitializer());

/** The e2e environment: the shell's (or `.env`'s) variables with the file's replacements. */
export function e2eEnv(options: { readonly env?: NodeJS.ProcessEnv; readonly role?: ServerRole } = {}): AppEnv {
  return loadEnv({ ...process.env, ...options.env, ROLE: options.role ?? 'api' });
}

/** The BullMQ key prefix of one e2e file, so files never see each other's jobs. */
export const e2eBullPrefix = (suite: string): string => `bull:test:${suite}`;

/**
 * The server config an e2e file boots: Vendure's `testConfig` overlaid with the role's real config, the
 * database straight to Postgres (the initializer gives each file its own database), migrations run at boot by
 * the api only, and a BullMQ prefix per file. `overrides` is merged last; its `plugins` are appended.
 */
export function buildE2eConfig(overrides: Partial<VendureConfig>, options: E2eConfigOptions): Required<VendureConfig> {
  const role = options.role ?? 'api';
  const env = e2eEnv(options);
  const prefix = e2eBullPrefix(options.suite);
  const roleConfig = buildVendureConfig(env, role);
  // The plugin keeps its options statically, so this replaces the prefix `buildVendureConfig` just set.
  BullMQJobQueuePlugin.init({ ...bullMqOptions(env), queueOptions: { prefix }, workerOptions: { prefix } });
  const merged = mergeConfig(testConfig, {
    ...roleConfig,
    apiOptions: { ...roleConfig.apiOptions, port: options.port },
    logger: new DefaultLogger({ level: LogLevel.Warn }),
  });
  // Replaced, not merged: `testConfig`'s sql.js options must not leak into the Postgres connection.
  const base: Required<VendureConfig> = {
    ...merged,
    dbConnectionOptions: {
      ...buildDbConfig(env, role),
      ...toPostgresFields(env.DATABASE_URL_DIRECT),
      synchronize: false,
      migrationsRun: role === 'api',
    },
  };
  const plugins = [...base.plugins, ...(overrides.plugins ?? [])];
  return mergeConfig(base, { ...overrides, plugins });
}

/** Algeria and its zero tax rate: the minimum Vendure's test population needs. */
export const E2E_INITIAL_DATA: InitialData = {
  defaultLanguage: LanguageCode.en,
  defaultZone: 'Algeria',
  taxRates: [{ name: 'Algeria zero rate', percentage: 0 }],
  shippingMethods: [],
  paymentMethods: [],
  countries: [{ name: 'Algeria', code: 'DZ', zone: 'Algeria' }],
  collections: [],
};

/** A Valkey client on the e2e Valkey; the caller disconnects it. */
export function e2eRedis(env: AppEnv = e2eEnv()): Redis {
  return new Redis({ ...redisOptionsFromUrl(env.REDIS_URL), maxRetriesPerRequest: null });
}

/** Removes every key under a test prefix with `SCAN` + `UNLINK` (never `KEYS`, never `FLUSHDB`). */
export async function removeBullKeys(prefix: string): Promise<void> {
  const redis = e2eRedis();
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', SCAN_BATCH);
      cursor = next;
      if (keys.length > 0) {
        await redis.unlink(...keys);
      }
    } while (cursor !== '0');
  } finally {
    redis.disconnect();
  }
}
