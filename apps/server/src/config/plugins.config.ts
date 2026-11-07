import { PlatformHealthPlugin } from '@cod/plugin-platform-health';
import { HardenPlugin } from '@vendure/harden-plugin';
import { BullMQJobQueuePlugin } from '@vendure/job-queue-plugin/package/bullmq';
import { DefaultSchedulerPlugin, RedisCachePlugin, type VendureConfig } from '@vendure/core';
import type { AppEnv, ServerRole } from './env';
import { bullMqOptions, redisOptionsFromUrl } from './redis.config';

/** One entry of `VendureConfig.plugins`: a plugin class or the module its `init` returns. */
export type VendurePluginEntry = NonNullable<VendureConfig['plugins']>[number];

/** The GraphQL query cost above which the api rejects a query. */
export const HARDEN_MAX_QUERY_COMPLEXITY = 1000;

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
    RedisCachePlugin.init({ redisOptions: redisOptionsFromUrl(env.REDIS_URL) }),
    DefaultSchedulerPlugin.init(),
    PlatformHealthPlugin.init({
      redisUrl: env.REDIS_URL,
      workerHealthPort: env.WORKER_HEALTH_PORT,
      serveWorkerHealth: role === 'worker',
    }),
  ];
  return role === 'api' ? [...everyRole, hardenPlugin(env)] : everyRole;
}
