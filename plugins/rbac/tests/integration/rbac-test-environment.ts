import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { createPluginTestEnvironment, ensurePartitionedSchema, loadPluginTestDbConfig } from '@cod/testing';
import { TransactionalConnection } from '@vendure/core';
import { ACTIVITY_LOG_SCHEMA } from '../../infrastructure/activity-log-schema';
import { RbacPlugin } from '../../rbac.plugin';
import { ActivityPublisherTestPlugin } from './fixtures/activity-publisher.plugin';
import { GuardedTestPlugin } from './fixtures/guarded-test.plugin';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

/**
 * A Vendure test server with tenancy, rate limiting, RBAC and the guarded fixture. Each test file passes its own worker id.
 * `synchronize` cannot make the partitioned `activity_log`, so `server.init` also creates it and its current partitions.
 */
export function createRbacTestEnvironment(snowflakeWorkerId: number): ReturnType<typeof createPluginTestEnvironment> {
  const environment = createPluginTestEnvironment({
    plugins: [
      PlatformPartitionsPlugin,
      // Clients are keyed by `req.ip`: these tests send no client address header.
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
      RbacPlugin,
      GuardedTestPlugin,
      ActivityPublisherTestPlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });
  const { server } = environment;
  const init = server.init.bind(server);
  server.init = async (...args: Parameters<typeof init>): Promise<void> => {
    await init(...args);
    await ensurePartitionedSchema(server.app.get(TransactionalConnection).rawConnection, [ACTIVITY_LOG_SCHEMA]);
    await server.app.get(PartitionMaintenanceService).maintain(new Date());
  };
  return environment;
}
