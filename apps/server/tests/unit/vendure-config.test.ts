import { PlatformHealthPlugin } from '@cod/plugin-platform-health';
import { getEntitiesFromPlugins, type VendureConfig } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { loadEnv, type ServerRole } from '../../src/config/env';
import { bullMqOptions } from '../../src/config/redis.config';
import { buildVendureConfig } from '../../src/config/vendure-config';

const valid = {
  APP_ENV: 'test',
  ROLE: 'api',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://cod:pw@pgbouncer:5432/cod',
  DATABASE_URL_DIRECT: 'postgresql://cod:pw@postgres:5432/cod',
  REDIS_URL: 'redis://valkey:6379',
  COOKIE_SECRET: 'x'.repeat(32),
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'test-password',
  S3_ENDPOINT: 'http://garage:3900',
  S3_ACCESS_KEY: 'GK' + 'a'.repeat(24),
  S3_SECRET_KEY: 'b'.repeat(64),
  S3_BUCKET_PRIVATE: 'cod-private',
};

const ROLES: readonly ServerRole[] = ['api', 'worker', 'migrate'];

/** The config of a process started with `ROLE=role`. */
const configFor = (role: ServerRole, overrides: Record<string, string> = {}): VendureConfig =>
  buildVendureConfig(loadEnv({ ...valid, ...overrides, ROLE: role }), role);

const pluginNamesOf = (config: VendureConfig): string[] =>
  (config.plugins ?? []).map((plugin) => ('module' in plugin ? plugin.module.name : plugin.name));

const entitiesOf = (config: VendureConfig): string[] =>
  getEntitiesFromPlugins(config.plugins)
    .map((entity) => entity.name)
    .sort();

describe('buildVendureConfig', () => {
  it('wires auth, health and money per ADR 0008/0013/0004', () => {
    const api = configFor('api');

    expect(api.apiOptions.port).toBe(3000);
    expect(api.authOptions.tokenMethod).toEqual(['cookie', 'bearer']);
    // Deprecated since Vendure 3.6, but `[]` is what keeps the built-in /health module silent (ADR 0013).
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(api.systemOptions?.healthChecks).toEqual([]);
    expect(api.entityOptions?.moneyStrategy?.precision).toBe(0);
  });

  it('api connects through pgbouncer, migrate directly', () => {
    const api = configFor('api');
    const migrate = configFor('migrate');

    expect(api.dbConnectionOptions).toMatchObject({
      type: 'postgres',
      host: 'pgbouncer',
      port: 5432,
      synchronize: false,
      extra: { max: 10 },
    });
    expect(migrate.dbConnectionOptions).toMatchObject({ host: 'postgres', extra: { max: 2 } });
  });

  it('registers the platform plugins', () => {
    const api = configFor('api');

    expect(pluginNamesOf(api)).toEqual(
      expect.arrayContaining([
        'BullMQJobQueuePlugin',
        'RedisCachePlugin',
        'DefaultSchedulerPlugin',
        'HardenPlugin',
        'PlatformHealthPlugin',
      ]),
    );
  });

  it('every role registers the same entity set (B1)', () => {
    const [api, worker, migrate] = ROLES.map((role) => entitiesOf(configFor(role)));

    expect(api).toContain('ScheduledTaskRecord');
    expect(worker).toEqual(api);
    expect(migrate).toEqual(api);
  });

  it('worker role passes WORKER_ACTIVE_QUEUES through', () => {
    const worker = configFor('worker', { WORKER_ACTIVE_QUEUES: 'q1' });
    const api = configFor('api', { WORKER_ACTIVE_QUEUES: 'q1' });

    expect(worker.jobQueueOptions?.activeQueues).toEqual(['q1']);
    expect(api.jobQueueOptions?.activeQueues).toBeUndefined();
  });

  it('only the worker serves the worker health port', () => {
    const served = ROLES.map((role) => {
      configFor(role);
      return PlatformHealthPlugin.options?.serveWorkerHealth;
    });

    expect(served).toEqual([false, true, false]);
  });
});

describe('bullMqOptions', () => {
  it('bullmq connection never caps retries and prefixes by env', () => {
    const options = bullMqOptions(loadEnv(valid));

    expect(options).toMatchObject({
      connection: { host: 'valkey', port: 6379, maxRetriesPerRequest: null },
      queueOptions: { prefix: 'bull:test' },
      workerOptions: { prefix: 'bull:test' },
    });
  });
});
