import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { createPluginTestEnvironment, loadPluginTestDbConfig } from '@cod/testing';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { VendurePlugin } from '@vendure/core';
import { AuthPlugin, type AuthEmailOptions, type AuthOAuthOptions } from '../../auth.plugin';
import { RandomAssetNamingStrategy } from '../../infrastructure/random-asset-naming.strategy';
import type { AuthEmailTemplatesPort } from '../../domain/ports/auth-email-templates.port';
import { EchoTemplates } from '../fakes/recording-email';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
const SNOWFLAKE_WORKER_ID = 1007;
const DEFAULT_MAILPIT_SMTP_PORT = 1026;
const TEST_DASHBOARD_URL = 'https://dash.example.test/dashboard';
/** The platform domain the test server is configured with. */
export const TEST_PLATFORM_DOMAIN = 'shops.example.test';

/** The header tests name the client address with, so one process can act as many addresses. */
export const TEST_CLIENT_IP_HEADER = 'x-test-client-ip';

/** Turns on the cookie method next to `testConfig`'s bearer one, as the server's `buildAuthConfig` does. */
@VendurePlugin({
  configuration: (config) => {
    config.authOptions.tokenMethod = ['cookie', 'bearer'];
    config.authOptions.cookieOptions = { secret: 'integration-test-only-cookie-secret' };
    return config;
  },
})
// A Vendure plugin is a decorated class; its metadata is the whole plugin.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class CookieSessionsTestPlugin {}

/** The compose Mailpit as seen from the host: the SMTP port `MAILPIT_SMTP_HOST_PORT` publishes. */
export function mailpitSmtp(): AuthEmailOptions['smtp'] {
  return {
    host: 'localhost',
    port: Number(process.env['MAILPIT_SMTP_HOST_PORT'] ?? DEFAULT_MAILPIT_SMTP_PORT),
    from: 'no-reply@localhost',
    tls: 'none',
  };
}

/** A Vendure test server with the auth plugin and what it depends on. */
export function createAuthTestEnvironment(
  tokenSecret: string,
  options: {
    readonly poolSize?: number;
    readonly templates?: AuthEmailTemplatesPort;
    readonly smtp?: AuthEmailOptions['smtp'];
    readonly cookieSessions?: boolean;
    /** Serves assets from a temporary directory at `/assets`, so uploads and their URLs can be tested. */
    readonly assets?: boolean;
    /** Turns the OAuth flag on, with these providers. */
    readonly oauth?: AuthOAuthOptions;
  } = {},
): ReturnType<typeof createPluginTestEnvironment> {
  const {
    templates = new EchoTemplates(),
    smtp = mailpitSmtp(),
    cookieSessions = false,
    assets = false,
    oauth,
    ...environment
  } = options;
  return createPluginTestEnvironment({
    plugins: [
      ...(cookieSessions ? [CookieSessionsTestPlugin] : []),
      ...(assets
        ? [
            AssetServerPlugin.init({
              route: 'assets',
              namingStrategy: new RandomAssetNamingStrategy(),
              assetUploadDir: mkdtempSync(join(tmpdir(), 'cod-test-assets-')),
            }),
          ]
        : []),
      RateLimitPlugin.init({ redisUrl: TEST_REDIS_URL, clientIpHeader: TEST_CLIENT_IP_HEADER }),
      TenancyPlugin.init({
        redisUrl: TEST_REDIS_URL,
        platformDomain: 'localhost',
        snowflakeWorkerId: SNOWFLAKE_WORKER_ID,
      }),
      AuthPlugin.init({
        tokenSecret,
        email: { smtp, templates },
        dashboardUrl: TEST_DASHBOARD_URL,
        platformDomain: TEST_PLATFORM_DOMAIN,
        ...(oauth === undefined ? {} : { oauth }),
      }),
    ],
    db: loadPluginTestDbConfig(process.env),
    ...environment,
  });
}
