import path from 'node:path';
import { MerchantShellPlugin } from '@cod/plugin-merchant-shell';
import { PlatformHealthPlugin } from '@cod/plugin-platform-health';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { HardenPlugin } from '@vendure/harden-plugin';
import { BullMQJobQueuePlugin } from '@vendure/job-queue-plugin/package/bullmq';
import { DefaultSchedulerPlugin, RedisCachePlugin, type VendureConfig } from '@vendure/core';
import type { AppEnv, ServerRole } from './env';
import { bullMqOptions, redisOptionsFromUrl } from './redis.config';

/** One entry of `VendureConfig.plugins`: a plugin class or the module its `init` returns. */
export type VendurePluginEntry = NonNullable<VendureConfig['plugins']>[number];

/** The Valkey key prefix of Vendure's cache, which also holds the sessions; `APP_ENV` is appended to it. */
export const CACHE_NAMESPACE_PREFIX = 'vendure-cache';

/** The GraphQL query cost above which the api rejects a query. */
export const HARDEN_MAX_QUERY_COMPLEXITY = 1000;

/** The merchant dashboard's route on the api (ADR 0010; `app.ourdomain/` from P3.S5). */
export const DASHBOARD_ROUTE = 'dashboard';

/**
 * The built dashboard (`build:dashboard`). The same relative path holds from `src/config` (host-run) and
 * from `dist/config` (the image): both resolve to `apps/server/dist/dashboard`.
 */
const DASHBOARD_APP_DIR = path.join(__dirname, '../../dist/dashboard');

/** The api's GraphQL hardening. It declares no entities, so leaving it out elsewhere keeps the schema equal. */
const hardenPlugin = (env: AppEnv): VendurePluginEntry =>
  HardenPlugin.init({
    maxQueryComplexity: HARDEN_MAX_QUERY_COMPLEXITY,
    apiMode: env.APP_ENV === 'production' ? 'prod' : 'dev',
  });

/**
 * The single registration point for plugins. Every role registers every plugin that declares entities, so
 * the `migrate` role creates every table (e.g. `scheduled_task_record`, B1); role-only plugins have none.
 */
export function buildPlugins(env: AppEnv, role: ServerRole): VendurePluginEntry[] {
  const everyRole: VendurePluginEntry[] = [
    BullMQJobQueuePlugin.init(bullMqOptions(env)),
    // Sessions live in this cache, so environments sharing a Valkey must never read each other's keys.
    RedisCachePlugin.init({
      redisOptions: redisOptionsFromUrl(env.REDIS_URL),
      namespace: `${CACHE_NAMESPACE_PREFIX}:${env.APP_ENV}`,
    }),
    DefaultSchedulerPlugin.init(),
    PlatformHealthPlugin.init({
      redisUrl: env.REDIS_URL,
      workerHealthPort: env.WORKER_HEALTH_PORT,
      serveWorkerHealth: role === 'worker',
    }),
  ];
  if (role !== 'api') {
    return everyRole;
  }
  return [
    ...everyRole,
    hardenPlugin(env),
    DashboardPlugin.init({ route: DASHBOARD_ROUTE, appDir: DASHBOARD_APP_DIR }),
    MerchantShellPlugin,
  ];
}
