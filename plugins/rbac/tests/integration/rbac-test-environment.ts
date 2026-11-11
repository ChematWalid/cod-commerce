import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { createPluginTestEnvironment, loadPluginTestDbConfig, type PluginTestEnvironmentOptions } from '@cod/testing';
import { RbacPlugin } from '../../rbac.plugin';
import { ActivityPublisherTestPlugin } from './fixtures/activity-publisher.plugin';
import { GuardedTestPlugin } from './fixtures/guarded-test.plugin';

export const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

/** How a second server joins the first one of its file (see {@link PluginTestEnvironmentOptions}). */
export type RbacTestServerOptions = Pick<PluginTestEnvironmentOptions, 'port' | 'attachToDatabase' | 'sharedCache'>;

/** A Vendure test server with tenancy, rate limiting, RBAC and the guarded fixture. Each test file passes its own worker id. */
export function createRbacTestEnvironment(
  snowflakeWorkerId: number,
  serverOptions: RbacTestServerOptions = {},
): ReturnType<typeof createPluginTestEnvironment> {
  return createPluginTestEnvironment({
    plugins: [
      // Clients are keyed by `req.ip`: these tests send no client address header.
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
      RbacPlugin,
      GuardedTestPlugin,
      ActivityPublisherTestPlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
    ...serverOptions,
  });
}
