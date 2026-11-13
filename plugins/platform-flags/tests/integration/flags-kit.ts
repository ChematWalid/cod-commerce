import { PlatformJobsPlugin, type PlatformClock } from '@cod/plugin-platform-jobs';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { PLATFORM_STAFF_PERMISSION } from '@cod/shared';
import { createPluginTestEnvironment, loadPluginTestDbConfig } from '@cod/testing';
import { PERMISSIONS_METADATA_KEY, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import { Redis } from 'ioredis';
import { PlatformFlagsPlugin } from '../../platform-flags.plugin';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

/** Valkey database 12 is the one new Valkey tests use (plan: Global Constraints); they delete only their own keys. */
const FLAGS_TEST_DATABASE = 12;

/** The test Valkey on database 12. */
export const FLAGS_REDIS_URL = ((): string => {
  const url = new URL(TEST_REDIS_URL);
  url.pathname = `/${String(FLAGS_TEST_DATABASE)}`;
  return url.toString();
})();

/** The Valkey for tenancy and the limiter these tests boot with the flags (database 0, as everywhere else). */
export const BASE_REDIS_URL = TEST_REDIS_URL;

/** A port nothing listens on: a Valkey that is down. */
export const CLOSED_REDIS_URL = 'redis://127.0.0.1:1/12';

type Environment = ReturnType<typeof createPluginTestEnvironment>;

/** A Vendure test server with tenancy and the flags plugin on the test Valkey. */
export function createFlagsTestEnvironment(
  snowflakeWorkerId: number,
  appEnv: string,
  clock?: PlatformClock,
): Environment {
  return createPluginTestEnvironment({
    plugins: [
      PlatformJobsPlugin.init({
        redisUrl: BASE_REDIS_URL,
        appEnv,
        ...(clock === undefined ? {} : { clock }),
      }),
      RateLimitPlugin.init({ redisUrl: BASE_REDIS_URL, clientIpHeader: '' }),
      TenancyPlugin.init({ redisUrl: BASE_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId }),
      PlatformFlagsPlugin.init({ redisUrl: FLAGS_REDIS_URL, appEnv }),
    ],
    db: loadPluginTestDbConfig(process.env),
  });
}

/** Deletes this test's own flag keys from Valkey database 12 (never a flush), so an earlier run's snapshot cannot leak in. */
export async function clearFlagKeys(appEnv: string): Promise<void> {
  const redis = new Redis(FLAGS_REDIS_URL);
  try {
    const keys = await redis.keys(`${appEnv}:flags:*`);
    if (keys.length > 0) await redis.del(...keys);
  } finally {
    await redis.quit();
  }
}

/** Raw SQL on the test server's database. */
export const sqlOf =
  (server: Environment['server']) =>
  (statement: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> =>
    server.app.get(TransactionalConnection).rawConnection.query(statement, parameters);

/** A flag as the Admin API returns it. */
export interface FlagResult {
  readonly key: string;
  readonly description: string;
  readonly defaultEnabled: boolean;
  readonly rolloutPercent: number;
  readonly updatedAt: string;
  readonly overrides: readonly { readonly scope: string; readonly scopeId: string; readonly enabled: boolean }[];
}

const FIELDS = 'key description defaultEnabled rolloutPercent updatedAt overrides { scope scopeId enabled }';

export const FEATURE_FLAGS = gql`
  query {
    featureFlags { ${FIELDS} }
  }
`;

export const UPDATE_FEATURE_FLAG = gql`
  mutation ($input: UpdateFeatureFlagInput!) {
    updateFeatureFlag(input: $input) { ${FIELDS} }
  }
`;

export const SET_OVERRIDE = gql`
  mutation ($input: FeatureFlagOverrideInput!) {
    setFeatureFlagOverride(input: $input) { ${FIELDS} }
  }
`;

export const REMOVE_OVERRIDE = gql`
  mutation ($input: FeatureFlagOverrideKeyInput!) {
    removeFeatureFlagOverride(input: $input) { ${FIELDS} }
  }
`;

export const EVALUATE = gql`
  query ($key: String!, $businessId: String, $storeId: String) {
    evaluateFeatureFlag(key: $key, businessId: $businessId, storeId: $storeId)
  }
`;

type Handler = (...args: never[]) => unknown;
type Class = abstract new (...args: never[]) => object;

const RESOLVER_TYPE = 'graphql:resolver_type';
const RESOLVER_NAME = 'graphql:resolver_name';
const ROOT_TYPES = new Set(['Query', 'Mutation']);

/** Every Admin API operation the plugin declares, with the Vendure permission names its `@Allow` holds. */
export function declaredOperations(): { readonly key: string; readonly allow: string }[] {
  const extension = Reflect.getMetadata('adminApiExtensions', PlatformFlagsPlugin) as { resolvers: Class[] };
  return extension.resolvers.flatMap((resolver) => {
    const prototype = resolver.prototype as Record<string, Handler>;
    return Object.getOwnPropertyNames(prototype)
      .filter((name) => name !== 'constructor')
      .flatMap((name) => {
        const handler = prototype[name] as Handler;
        const type = Reflect.getMetadata(RESOLVER_TYPE, handler) as string | undefined;
        if (type === undefined || !ROOT_TYPES.has(type)) return [];
        const operation = (Reflect.getMetadata(RESOLVER_NAME, handler) as string | undefined) ?? name;
        const permissions = Reflect.getMetadata(PERMISSIONS_METADATA_KEY, handler) as string[] | undefined;
        return [{ key: operation, allow: permissions?.join(',') ?? 'unguarded' }];
      });
  });
}

/** The permission every operation must hold. */
export const STAFF_ONLY = PLATFORM_STAFF_PERMISSION;
