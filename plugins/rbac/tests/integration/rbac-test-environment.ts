import { TenancyPlugin } from '@cod/plugin-tenancy';
import { createPluginTestEnvironment, loadPluginTestDbConfig } from '@cod/testing';
import { RbacPlugin } from '../../rbac.plugin';
import { ActivityPublisherTestPlugin } from './fixtures/activity-publisher.plugin';
import { GuardedTestPlugin } from './fixtures/guarded-test.plugin';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

/** A Vendure test server with tenancy, RBAC and the guarded fixture. Each test file passes its own worker id. */
export function createRbacTestEnvironment(snowflakeWorkerId: number): ReturnType<typeof createPluginTestEnvironment> {
  return createPluginTestEnvironment({
    plugins: [
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
      RbacPlugin,
      GuardedTestPlugin,
      ActivityPublisherTestPlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });
}
