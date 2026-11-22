import path from 'node:path';
import { AuthPlugin, type AuthOAuthOptions, type AuthPluginOptions, type SmtpOptions } from '@cod/plugin-auth';
import { CatalogPlugin } from '@cod/plugin-catalog';
import { CatalogImportPlugin } from '@cod/plugin-catalog-import';
import { CatalogPacksPlugin } from '@cod/plugin-catalog-packs';
import { CollectionsRulesPlugin } from '@cod/plugin-collections-rules';
import { GeoPlugin } from '@cod/plugin-geo';
import { MerchantShellPlugin } from '@cod/plugin-merchant-shell';
import { OffersPlugin } from '@cod/plugin-offers';
import { PlatformFlagsPlugin } from '@cod/plugin-platform-flags';
import { PlatformHealthPlugin } from '@cod/plugin-platform-health';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { parseKekRing, PlatformSecretsPlugin } from '@cod/plugin-platform-secrets';
import { PlatformWebhooksPlugin } from '@cod/plugin-platform-webhooks';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { RbacPlugin } from '@cod/plugin-rbac';
import { TeamPlugin } from '@cod/plugin-team';
import { TemplatePlugin } from '@cod/plugin-template';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { parseInternalKeys } from '@cod/shared/internal-auth';
import { parseQuoteKeys, quoteKeyRing } from '@cod/shared/quote-keys';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { HardenPlugin } from '@vendure/harden-plugin';
import { BullMQJobQueuePlugin } from '@vendure/job-queue-plugin/package/bullmq';
import { DefaultSchedulerPlugin, RedisCachePlugin, type VendureConfig } from '@vendure/core';
import { authEmailTemplates } from '../email';
import { assetServerPlugin } from './asset-storage.config';
import { isDeployed } from './deployed-env';
import { MigrateNoSchedulerPlugin } from './migrate-no-scheduler.plugin';
import { DASHBOARD_ROUTE } from './dashboard-route';
import type { AppEnv, ServerRole } from './env';
import { bullMqOptions, redisOptionsFromUrl } from './redis.config';

/** One entry of `VendureConfig.plugins`: a plugin class or the module its `init` returns. */
export type VendurePluginEntry = NonNullable<VendureConfig['plugins']>[number];

/** The Valkey key prefix of Vendure's cache, which also holds the sessions; `APP_ENV` is appended to it. */
export const CACHE_NAMESPACE_PREFIX = 'vendure-cache';

/** The GraphQL query cost above which the api rejects a query. */
export const HARDEN_MAX_QUERY_COMPLEXITY = 1000;

/**
 * The built dashboard (`build:dashboard`). The same relative path holds from `src/config` (host-run) and
 * from `dist/config` (the image): both resolve to `apps/server/dist/dashboard`.
 */
type AuthOAuthProviderSettings = AuthOAuthOptions['providers']['google'];

const DASHBOARD_APP_DIR = path.join(__dirname, '../../dist/dashboard');

/** The api's GraphQL hardening. It declares no entities, so leaving it out elsewhere keeps the schema equal. */
const hardenPlugin = (env: AppEnv): VendurePluginEntry =>
  HardenPlugin.init({
    maxQueryComplexity: HARDEN_MAX_QUERY_COMPLEXITY,
    apiMode: isDeployed(env) ? 'prod' : 'dev',
  });

/** The readiness probes; only the worker serves its own health port. */
const healthPlugin = (env: AppEnv, role: ServerRole): VendurePluginEntry =>
  PlatformHealthPlugin.init({
    redisUrl: env.REDIS_URL,
    workerHealthPort: env.WORKER_HEALTH_PORT,
    serveWorkerHealth: role === 'worker',
  });

/** Guards the Shop API, /store and /_internal on every host with the internal signature (D112). */
const webhooksPlugin = (env: AppEnv): VendurePluginEntry =>
  PlatformWebhooksPlugin.init({
    internalKeys: parseInternalKeys(env.INTERNAL_HMAC_KEYS),
    demoHandlers: env.PLATFORM_DEMO_HANDLERS,
  });

/**
 * The platform plugins with tenant tables (and the flags, which read tenancy): they register after tenancy, which
 * scopes their rows. The outbox needs
 * jobs and partitions before it (the relay queue and the retention policies); the secrets' Admin API guards with
 * the permissions `RbacPlugin` defines.
 */
const tenantDataPlugins = (env: AppEnv): VendurePluginEntry[] => [
  PlatformOutboxPlugin,
  PlatformFlagsPlugin.init({ redisUrl: env.REDIS_URL, appEnv: env.APP_ENV }),
  PlatformSecretsPlugin.init({ kekRing: parseKekRing(env.TENANT_SECRET_KEKS, env.TENANT_SECRET_ACTIVE_KID) }),
];

/** What answers or refuses requests before the rest of the app: the probes and the internal-only guard. */
const requestPathPlugins = (env: AppEnv, role: ServerRole): VendurePluginEntry[] => [
  healthPlugin(env, role),
  webhooksPlugin(env),
];

/** The OAuth flag: the options stay absent while it is off, and that absence is what switches the feature off (D36). */
function oauthOptions(env: AppEnv): Pick<AuthPluginOptions, 'oauth'> {
  if (!env.AUTH_OAUTH_ENABLED) {
    return {};
  }
  const provider = (clientId: string | undefined, clientSecret: string | undefined): AuthOAuthProviderSettings => ({
    // `requireAuthSettings` refused to boot without these when the flag is on.
    clientId: clientId ?? '',
    clientSecret: clientSecret ?? '',
  });
  return {
    oauth: {
      providers: {
        google: {
          ...provider(env.GOOGLE_OAUTH_CLIENT_ID, env.GOOGLE_OAUTH_CLIENT_SECRET),
          authorizeUrl: env.GOOGLE_OAUTH_AUTHORIZE_URL,
          tokenUrl: env.GOOGLE_OAUTH_TOKEN_URL,
          userInfoUrl: env.GOOGLE_OAUTH_USERINFO_URL,
        },
        facebook: {
          ...provider(env.FACEBOOK_OAUTH_CLIENT_ID, env.FACEBOOK_OAUTH_CLIENT_SECRET),
          authorizeUrl: env.FACEBOOK_OAUTH_AUTHORIZE_URL,
          tokenUrl: env.FACEBOOK_OAUTH_TOKEN_URL,
          userInfoUrl: env.FACEBOOK_OAUTH_USERINFO_URL,
        },
      },
      secureCookie: env.APP_ENV !== 'development',
    },
  };
}

/** The SMTP relay; `loadEnv` has checked that the username and the password come together. */
function smtpOptions(env: AppEnv): SmtpOptions {
  const relay = { host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.SMTP_FROM, tls: env.SMTP_TLS };
  if (env.SMTP_USERNAME === undefined || env.SMTP_PASSWORD === undefined) {
    return relay;
  }
  return { ...relay, auth: { user: env.SMTP_USERNAME, pass: env.SMTP_PASSWORD } };
}

/** The account plugin with its secret and the mail side: SMTP settings and the wording (D32). */
const authPlugin = (env: AppEnv): VendurePluginEntry =>
  AuthPlugin.init({
    tokenSecret: env.AUTH_TOKEN_SECRET,
    email: {
      smtp: smtpOptions(env),
      templates: authEmailTemplates,
    },
    dashboardUrl: env.AUTH_DASHBOARD_URL,
    platformDomain: env.PLATFORM_DOMAIN,
    ...(env.TURNSTILE_ENABLED && env.TURNSTILE_SECRET_KEY !== undefined && env.TURNSTILE_CHALLENGE_URL !== undefined
      ? {
          challenge: {
            secretKey: env.TURNSTILE_SECRET_KEY,
            challengeUrl: env.TURNSTILE_CHALLENGE_URL,
            siteverifyUrl: env.TURNSTILE_SITEVERIFY_URL,
          },
        }
      : {}),
    ...oauthOptions(env),
  });

/** Import and export on the private Garage bucket (D2208): the server signs browser links on the public endpoint. */
const catalogImportPlugin = (env: AppEnv): VendurePluginEntry =>
  CatalogImportPlugin.init({
    objectStorage: {
      kind: 's3',
      endpoint: env.S3_ENDPOINT,
      publicEndpoint: env.S3_PUBLIC_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      bucket: env.S3_BUCKET_PRIVATE,
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    linkScraper: env.LINK_IMPORT_SCRAPER,
    appEnv: env.APP_ENV,
  });

/**
 * RBAC, auth, catalog, offers, collections and Team, in this order: Team builds on the services of the others (D206)
 * and registers its order-manager check in the catalog module, so Catalog configures after Auth and before Team
 * (D2137); the offers (D2402) and then the collections (P2.S3) import the catalog module and configure after it.
 * The catalog feature plugins (packs and import) come after Team and write through catalog's exported facade (D2200).
 * Geo comes first: global reference data, not tenant data (D3103), the wilayas and communes delivery pricing reads.
 */
function memberPlugins(env: AppEnv): VendurePluginEntry[] {
  return [
    GeoPlugin,
    RbacPlugin,
    authPlugin(env),
    CatalogPlugin,
    OffersPlugin.init({ quoteKeys: quoteKeyRing(parseQuoteKeys(env.QUOTE_HMAC_KEYS), env.QUOTE_HMAC_ACTIVE_KID) }),
    CollectionsRulesPlugin,
    TeamPlugin.init({ dashboardUrl: env.AUTH_DASHBOARD_URL }),
    CatalogPacksPlugin,
    catalogImportPlugin(env),
  ];
}

/**
 * Plugins that exist to show and test the platform's own patterns: the reference plugin. Staging has the
 * production shape, so only development and test register them (D2111, #170); their committed migrations still
 * create their tables everywhere.
 */
function developmentOnlyPlugins(env: AppEnv): VendurePluginEntry[] {
  return env.APP_ENV === 'development' || env.APP_ENV === 'test' ? [TemplatePlugin] : [];
}

/**
 * The single registration point for plugins. Every role registers every plugin that declares entities, so
 * the `migrate` role creates every table (e.g. `scheduled_task_record`, B1); role-only plugins have none.
 */
export function buildPlugins(env: AppEnv, role: ServerRole): VendurePluginEntry[] {
  const everyRole: VendurePluginEntry[] = [
    BullMQJobQueuePlugin.init(bullMqOptions(env)),
    // Right after BullMQ's plugin: its configuration replaces the stock strategy and index task with the pooled
    // ones (D100), and the stock plugin keeps providing the Redis health indicator the pools use.
    PlatformJobsPlugin.init({ redisUrl: env.REDIS_URL, appEnv: env.APP_ENV, pooledQueues: bullMqOptions(env) }),
    // Owning plugins register their tables' partition policies in `onModuleInit`; the registry closes at bootstrap.
    PlatformPartitionsPlugin,
    // Sessions live in this cache, so environments sharing a Valkey must never read each other's keys.
    RedisCachePlugin.init({
      redisOptions: redisOptionsFromUrl(env.REDIS_URL),
      namespace: `${CACHE_NAMESPACE_PREFIX}:${env.APP_ENV}`,
    }),
    DefaultSchedulerPlugin.init(),
    ...requestPathPlugins(env, role),
    ...developmentOnlyPlugins(env),
    // Tenancy, RBAC and auth use the rate limiter but never configure it: the host does, here.
    RateLimitPlugin.init({ redisUrl: env.REDIS_URL, clientIpHeader: env.CLIENT_IP_HEADER }),
    TenancyPlugin.init({
      redisUrl: env.REDIS_URL,
      platformDomain: env.PLATFORM_DOMAIN,
      snowflakeWorkerId: env.SNOWFLAKE_WORKER_ID,
      cacheNamespace: env.APP_ENV,
    }),
    ...tenantDataPlugins(env),
    ...memberPlugins(env),
    assetServerPlugin(env),
  ];
  if (role !== 'api') {
    // Last on `migrate`, so it runs after `DefaultSchedulerPlugin`'s configuration (D122, SRV-12).
    return role === 'migrate' ? [...everyRole, MigrateNoSchedulerPlugin] : everyRole;
  }
  return [
    ...everyRole,
    hardenPlugin(env),
    DashboardPlugin.init({ route: DASHBOARD_ROUTE, appDir: DASHBOARD_APP_DIR }),
    MerchantShellPlugin,
  ];
}
