import { TenancyPlugin } from '@cod/plugin-tenancy';
import { createPluginTestEnvironment, loadPluginTestDbConfig } from '@cod/testing';
import { AuthPlugin } from '../../auth.plugin';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
const SNOWFLAKE_WORKER_ID = 1007;

/** A Vendure test server with the auth plugin and what it depends on. */
export function createAuthTestEnvironment(
  tokenSecret: string,
  options: { readonly poolSize?: number } = {},
): ReturnType<typeof createPluginTestEnvironment> {
  return createPluginTestEnvironment({
    plugins: [
      TenancyPlugin.init({
        redisUrl: TEST_REDIS_URL,
        platformDomain: 'localhost',
        snowflakeWorkerId: SNOWFLAKE_WORKER_ID,
      }),
      AuthPlugin.init({ tokenSecret }),
    ],
    db: loadPluginTestDbConfig(process.env),
    ...options,
  });
}
