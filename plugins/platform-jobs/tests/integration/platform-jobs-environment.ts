import { createPluginTestEnvironment, loadPluginTestDbConfig } from '@cod/testing';
import type { PlatformClock } from '../../domain/clock.port';
import { PlatformJobsPlugin } from '../../platform-jobs.plugin';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

/**
 * A Vendure test server with the platform-jobs plugin and a Postgres database of its own. Without `pooledQueues`
 * the plugin leaves Vendure's in-memory queue strategy, which runs jobs in-process (D103 tests).
 * @param clock the platform clock; the system clock when omitted.
 * @param extraPlugins registered after the platform-jobs plugin, so their `onModuleInit` runs after its own.
 */
export function createPlatformJobsTestEnvironment(
  clock?: PlatformClock,
  extraPlugins: NonNullable<Parameters<typeof createPluginTestEnvironment>[0]['plugins']> = [],
): ReturnType<typeof createPluginTestEnvironment> {
  return createPluginTestEnvironment({
    db: loadPluginTestDbConfig(process.env),
    plugins: [
      PlatformJobsPlugin.init({
        redisUrl: TEST_REDIS_URL,
        appEnv: 'test-platform-jobs',
        ...(clock === undefined ? {} : { clock }),
      }),
      ...extraPlugins,
    ],
  });
}
