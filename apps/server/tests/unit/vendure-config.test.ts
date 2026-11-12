import { PlatformHealthPlugin } from '@cod/plugin-platform-health';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { activeQueuesFor, QUEUES } from '@cod/shared';
import {
  defaultConfig,
  getConfigurationFunction,
  getEntitiesFromPlugins,
  mergeConfig,
  RedisCachePlugin,
  type VendureConfig,
} from '@vendure/core';
import { NoopSchedulerStrategy } from '@vendure/core/dist/scheduler/noop-scheduler-strategy';
import { BullMQJobQueueStrategy } from '@vendure/job-queue-plugin/package/bullmq/bullmq-job-queue-strategy';
import { describe, expect, it } from 'vitest';
import { loadEnv, type ServerRole } from '../../src/config/env';
import { assertPooledJobQueue, buildJobQueueConfig } from '../../src/config/job-queue.config';
import { CACHE_NAMESPACE_PREFIX } from '../../src/config/plugins.config';
import { bullMqOptions } from '../../src/config/redis.config';
import { buildVendureConfig } from '../../src/config/vendure-config';
import { TEST_ENV } from '../support/deployed-env.fixture';

const valid = { ...TEST_ENV };

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

/** The scheduler strategy the app ends up with once every plugin's configuration step has run, as at bootstrap. */
async function schedulerStrategyAfterPlugins(config: VendureConfig): Promise<object | undefined> {
  const merged = mergeConfig(defaultConfig, config);
  for (const plugin of config.plugins ?? []) {
    await getConfigurationFunction(plugin)?.(merged);
  }
  return merged.schedulerOptions.schedulerStrategy;
}

describe('buildVendureConfig', () => {
  it('SRV-12: the migrate role ends up with the no-op scheduler and the worker keeps the real one', async () => {
    expect(await schedulerStrategyAfterPlugins(configFor('migrate'))).toBeInstanceOf(NoopSchedulerStrategy);
    const worker = await schedulerStrategyAfterPlugins(configFor('worker'));
    expect(worker).toBeDefined();
    expect(worker).not.toBeInstanceOf(NoopSchedulerStrategy);
    expect(await schedulerStrategyAfterPlugins(configFor('api'))).not.toBeInstanceOf(NoopSchedulerStrategy);
  });

  it('SRV-2: only the migrate connection carries the lock and statement timeouts', () => {
    const extra = (role: ServerRole): Record<string, unknown> =>
      (configFor(role).dbConnectionOptions as { extra: Record<string, unknown> }).extra;
    expect(extra('migrate')).toMatchObject({ lock_timeout: 5_000, statement_timeout: 900_000 });
    expect(extra('api')).not.toHaveProperty('lock_timeout');
    expect(extra('worker')).not.toHaveProperty('statement_timeout');
  });

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

  it('migrate logs errors, schema and migrations but never queries; other roles keep the default', () => {
    expect(configFor('migrate').dbConnectionOptions.logging).toEqual(['error', 'schema', 'migration']);
    expect(configFor('api').dbConnectionOptions.logging).toBeUndefined();
    expect(configFor('worker').dbConnectionOptions.logging).toBeUndefined();
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

  it('registers HardenPlugin for the api only', () => {
    const [api, worker, migrate] = ROLES.map((role) => pluginNamesOf(configFor(role)));

    expect(api).toContain('HardenPlugin');
    expect(worker).not.toContain('HardenPlugin');
    expect(migrate).not.toContain('HardenPlugin');
  });

  it('serves the dashboard with the merchant shell from the api only (ADR 0010)', () => {
    const [api, worker, migrate] = ROLES.map((role) => pluginNamesOf(configFor(role)));

    expect(api).toEqual(expect.arrayContaining(['DashboardPlugin', 'MerchantShellPlugin']));
    for (const other of [worker, migrate]) {
      expect(other).not.toContain('DashboardPlugin');
      expect(other).not.toContain('MerchantShellPlugin');
    }
  });

  it('scopes the cache and session namespace by APP_ENV', () => {
    const namespaces = ['staging', 'production'].map((appEnv) => {
      configFor('api', { APP_ENV: appEnv, CLIENT_IP_HEADER: 'cf-connecting-ip' });
      return RedisCachePlugin.options.namespace;
    });

    expect(namespaces).toEqual([`${CACHE_NAMESPACE_PREFIX}:staging`, `${CACHE_NAMESPACE_PREFIX}:production`]);
  });

  it('namespaces the host cache by APP_ENV (TEN-11)', () => {
    const namespaces = ['staging', 'production'].map((appEnv) => {
      configFor('api', { APP_ENV: appEnv, CLIENT_IP_HEADER: 'cf-connecting-ip' });
      return TenancyPlugin.options?.cacheNamespace;
    });

    expect(namespaces).toEqual(['staging', 'production']);
  });

  it('every role registers the same entity set (B1)', () => {
    const [api, worker, migrate] = ROLES.map((role) => entitiesOf(configFor(role)));

    expect(api).toContain('ScheduledTaskRecord');
    expect(worker).toEqual(api);
    expect(migrate).toEqual(api);
  });

  it('lists PlatformJobsPlugin right after BullMQJobQueuePlugin, with the pooled queues', () => {
    for (const role of ROLES) {
      const names = pluginNamesOf(configFor(role));

      expect(names.indexOf('PlatformJobsPlugin')).toBe(names.indexOf('BullMQJobQueuePlugin') + 1);
      expect(PlatformJobsPlugin.options).toMatchObject({ appEnv: 'test', redisUrl: 'redis://valkey:6379' });
      expect(PlatformJobsPlugin.usesPooledQueues()).toBe(true);
    }
  });

  it('boots a worker of one pool with the queues of that pool', () => {
    const critical = configFor('worker', { WORKER_POOL: 'critical' });

    expect(critical.jobQueueOptions?.activeQueues).toEqual(activeQueuesFor('critical'));
  });

  it('refuses activeQueues with a strategy that is not the pooled one', () => {
    const config = configFor('worker', { WORKER_POOL: 'bulk' });

    expect(() => {
      assertPooledJobQueue({
        ...config,
        jobQueueOptions: { ...config.jobQueueOptions, jobQueueStrategy: new BullMQJobQueueStrategy() },
      });
    }).toThrow(/PooledJobQueueStrategy/);
  });

  it('refuses activeQueues when PlatformJobsPlugin will not install the pooled strategy', () => {
    const config = configFor('worker', { WORKER_POOL: 'critical' });
    PlatformJobsPlugin.init({ redisUrl: 'redis://valkey:6379', appEnv: 'test' });

    expect(() => {
      assertPooledJobQueue(config);
    }).toThrow(/PooledJobQueueStrategy/);
    expect(() => {
      assertPooledJobQueue({ ...config, jobQueueOptions: {} });
    }).not.toThrow();
  });

  it('only the worker serves the worker health port', () => {
    const served = ROLES.map((role) => {
      configFor(role);
      return PlatformHealthPlugin.options?.serveWorkerHealth;
    });

    expect(served).toEqual([false, true, false]);
  });
});

describe('buildJobQueueConfig', () => {
  const envFor = (role: ServerRole, pool: string) => loadEnv({ ...valid, ROLE: role, WORKER_POOL: pool });

  it('gives a worker the queues of its pool and every queue for all', () => {
    expect(buildJobQueueConfig(envFor('worker', 'critical'), 'worker')).toEqual({
      activeQueues: activeQueuesFor('critical'),
    });
    expect(buildJobQueueConfig(envFor('worker', 'bulk'), 'worker')).toEqual({ activeQueues: activeQueuesFor('bulk') });
    expect(buildJobQueueConfig(envFor('worker', 'all'), 'worker')).toEqual({ activeQueues: [] });
  });

  it('leaves the api and migrate roles alone', () => {
    expect(buildJobQueueConfig(envFor('api', 'bulk'), 'api')).toEqual({});
    expect(buildJobQueueConfig(envFor('migrate', 'bulk'), 'migrate')).toEqual({});
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

  it('takes attempts and backoff of every queue from the registry', () => {
    // Arrange
    const { setJobOptions } = bullMqOptions(loadEnv(valid));
    const job = { data: {} } as Parameters<NonNullable<typeof setJobOptions>>[1];

    // Act and assert
    expect(setJobOptions?.('auth-email', job)).toEqual({
      attempts: QUEUES['auth-email'].attempts,
      backoff: { type: 'exponential', delay: 30_000 },
    });
  });
});
