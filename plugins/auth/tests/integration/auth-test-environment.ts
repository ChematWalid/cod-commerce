import { TenancyPlugin } from '@cod/plugin-tenancy';
import { createPluginTestEnvironment, loadPluginTestDbConfig } from '@cod/testing';
import { AuthPlugin, type AuthEmailOptions } from '../../auth.plugin';
import type { AuthEmailTemplatesPort } from '../../domain/ports/auth-email-templates.port';
import { EchoTemplates } from '../fakes/recording-email';

const TEST_REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6380';
const SNOWFLAKE_WORKER_ID = 1007;
const DEFAULT_MAILPIT_SMTP_PORT = 1026;

/** The compose Mailpit as seen from the host: the SMTP port `MAILPIT_SMTP_HOST_PORT` publishes. */
export function mailpitSmtp(): AuthEmailOptions['smtp'] {
  return {
    host: 'localhost',
    port: Number(process.env['MAILPIT_SMTP_HOST_PORT'] ?? DEFAULT_MAILPIT_SMTP_PORT),
    from: 'no-reply@localhost',
  };
}

/** A Vendure test server with the auth plugin and what it depends on. */
export function createAuthTestEnvironment(
  tokenSecret: string,
  options: {
    readonly poolSize?: number;
    readonly templates?: AuthEmailTemplatesPort;
    readonly smtp?: AuthEmailOptions['smtp'];
  } = {},
): ReturnType<typeof createPluginTestEnvironment> {
  const { templates = new EchoTemplates(), smtp = mailpitSmtp(), ...environment } = options;
  return createPluginTestEnvironment({
    plugins: [
      TenancyPlugin.init({
        redisUrl: TEST_REDIS_URL,
        platformDomain: 'localhost',
        snowflakeWorkerId: SNOWFLAKE_WORKER_ID,
      }),
      AuthPlugin.init({ tokenSecret, email: { smtp, templates } }),
    ],
    db: loadPluginTestDbConfig(process.env),
    ...environment,
  });
}
