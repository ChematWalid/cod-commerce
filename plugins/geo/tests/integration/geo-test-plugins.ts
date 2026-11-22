import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { GeoPlugin } from '../../geo.plugin';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

/**
 * The geo plugin and the modules it imports, configured the way the server does: the rate limiter guards the public
 * routes and tenancy finds the stores of the signed ones. One snowflake worker id per test file.
 */
export const geoTestPlugins = (
  snowflakeWorkerId: number,
): [typeof RateLimitPlugin, typeof TenancyPlugin, typeof GeoPlugin] => [
  RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: '' }),
  TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
  GeoPlugin,
];
