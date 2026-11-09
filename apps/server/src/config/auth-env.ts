import { z } from 'zod';

const MIN_AUTH_TOKEN_SECRET_LENGTH = 32;
const MAX_PORT = 65535;

/** Where a host-run server finds its dashboard and Mailpit; deployed environments must set their own. */
const DEV_AUTH_DASHBOARD_URL = 'http://localhost:3100/dashboard';
const DEV_SMTP_HOST = 'localhost';
const DEV_SMTP_PORT = 1026;
const DEV_SMTP_FROM = 'no-reply@localhost';

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const url = z.url().optional();
const text = z.string().min(1).optional();

/** The variables of the auth plugin, spread into the server's schema. */
export const authEnvShape = {
  AUTH_TOKEN_SECRET: z.string().min(MIN_AUTH_TOKEN_SECRET_LENGTH),
  AUTH_DASHBOARD_URL: url,
  SMTP_HOST: text,
  SMTP_PORT: z.coerce.number().int().min(1).max(MAX_PORT).optional(),
  SMTP_FROM: text,
  AUTH_OAUTH_ENABLED: flag,
  GOOGLE_OAUTH_CLIENT_ID: text,
  GOOGLE_OAUTH_CLIENT_SECRET: text,
  GOOGLE_OAUTH_AUTHORIZE_URL: url,
  GOOGLE_OAUTH_TOKEN_URL: url,
  GOOGLE_OAUTH_USERINFO_URL: url,
  FACEBOOK_OAUTH_CLIENT_ID: text,
  FACEBOOK_OAUTH_CLIENT_SECRET: text,
  FACEBOOK_OAUTH_AUTHORIZE_URL: url,
  FACEBOOK_OAUTH_TOKEN_URL: url,
  FACEBOOK_OAUTH_USERINFO_URL: url,
  TURNSTILE_ENABLED: flag,
  TURNSTILE_SECRET_KEY: text,
  TURNSTILE_CHALLENGE_URL: url,
};

type AuthEnv = z.infer<z.ZodObject<typeof authEnvShape>>;

/** The auth secrets, for the placeholder check. */
export function authSecretsOf(env: AuthEnv): [name: string, value: string | undefined][] {
  return [
    ['AUTH_TOKEN_SECRET', env.AUTH_TOKEN_SECRET],
    ['GOOGLE_OAUTH_CLIENT_SECRET', env.GOOGLE_OAUTH_CLIENT_SECRET],
    ['FACEBOOK_OAUTH_CLIENT_SECRET', env.FACEBOOK_OAUTH_CLIENT_SECRET],
    ['TURNSTILE_SECRET_KEY', env.TURNSTILE_SECRET_KEY],
  ];
}

const DEPLOYED_REQUIRED = ['AUTH_DASHBOARD_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM'] as const;
const OAUTH_REQUIRED = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'FACEBOOK_OAUTH_CLIENT_ID',
  'FACEBOOK_OAUTH_CLIENT_SECRET',
] as const;
const TURNSTILE_REQUIRED = ['TURNSTILE_SECRET_KEY', 'TURNSTILE_CHALLENGE_URL'] as const;

function requireAll(env: AuthEnv, names: readonly (keyof AuthEnv)[], reason: string, context: z.RefinementCtx): void {
  for (const name of names.filter((candidate) => env[candidate] === undefined)) {
    context.addIssue({ code: 'custom', path: [name], message: `is required ${reason}` });
  }
}

/** A switched-on feature needs its credentials, and a deployed server its real mail and dashboard addresses. */
export function requireAuthSettings(env: AuthEnv, deployed: boolean, context: z.RefinementCtx): void {
  if (deployed) {
    requireAll(env, DEPLOYED_REQUIRED, 'in this environment', context);
  }
  if (env.AUTH_OAUTH_ENABLED) {
    requireAll(env, OAUTH_REQUIRED, 'when AUTH_OAUTH_ENABLED is true', context);
  }
  if (env.TURNSTILE_ENABLED) {
    requireAll(env, TURNSTILE_REQUIRED, 'when TURNSTILE_ENABLED is true', context);
  }
}

/** The development fallbacks of the settings a deployed server must set. */
export function authDefaults(
  env: AuthEnv,
): Required<Pick<AuthEnv, 'AUTH_DASHBOARD_URL' | 'SMTP_HOST' | 'SMTP_PORT' | 'SMTP_FROM'>> {
  return {
    AUTH_DASHBOARD_URL: env.AUTH_DASHBOARD_URL ?? DEV_AUTH_DASHBOARD_URL,
    SMTP_HOST: env.SMTP_HOST ?? DEV_SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT ?? DEV_SMTP_PORT,
    SMTP_FROM: env.SMTP_FROM ?? DEV_SMTP_FROM,
  };
}
