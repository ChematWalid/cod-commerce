import path from 'node:path';
import { AuthPlugin, type AuthOAuthOptions, type AuthPluginOptions } from '@cod/plugin-auth';
import { MerchantShellPlugin } from '@cod/plugin-merchant-shell';
import { PlatformHealthPlugin } from '@cod/plugin-platform-health';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TemplatePlugin } from '@cod/plugin-template';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { HardenPlugin } from '@vendure/harden-plugin';
import { BullMQJobQueuePlugin } from '@vendure/job-queue-plugin/package/bullmq';
import { DefaultSchedulerPlugin, RedisCachePlugin, type VendureConfig } from '@vendure/core';
import { authEmailTemplates } from '../email';
import { assetServerPlugin } from './asset-storage.config';
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
    apiMode: env.APP_ENV === 'production' ? 'prod' : 'dev',
  });

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

/** The account plugin with its secret and the mail side: SMTP settings and the wording (D32). */
const authPlugin = (env: AppEnv): VendurePluginEntry =>
  AuthPlugin.init({
    tokenSecret: env.AUTH_TOKEN_SECRET,
    email: {
      smtp: { host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.SMTP_FROM },
      templates: authEmailTemplates,
    },
    dashboardUrl: env.AUTH_DASHBOARD_URL,
    platformDomain: env.PLATFORM_DOMAIN,
    ...(env.TURNSTILE_ENABLED && env.TURNSTILE_SECRET_KEY !== undefined && env.TURNSTILE_CHALLENGE_URL !== undefined
      ? { challenge: { secretKey: env.TURNSTILE_SECRET_KEY, challengeUrl: env.TURNSTILE_CHALLENGE_URL } }
      : {}),
    ...oauthOptions(env),
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
    TemplatePlugin,
    // The order is free: tenancy's `init` only fills rate-limit options that are still unset, and this call
    // replaces them either way.
    RateLimitPlugin.init({ redisUrl: env.REDIS_URL, clientIpHeader: env.CLIENT_IP_HEADER }),
    TenancyPlugin.init({
      redisUrl: env.REDIS_URL,
      platformDomain: env.PLATFORM_DOMAIN,
      snowflakeWorkerId: env.SNOWFLAKE_WORKER_ID,
    }),
    authPlugin(env),
    assetServerPlugin(env),
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
