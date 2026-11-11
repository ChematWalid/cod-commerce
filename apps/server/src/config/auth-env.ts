import type { SmtpTlsMode } from '@cod/plugin-auth';
import { z } from 'zod';

const MIN_AUTH_TOKEN_SECRET_LENGTH = 32;
const MAX_PORT = 65535;

/** Where a host-run server finds its dashboard and Mailpit; deployed environments must set their own. */
const DEV_AUTH_DASHBOARD_URL = 'http://localhost:3100/dashboard';
const DEV_SMTP_HOST = 'localhost';
const DEV_SMTP_PORT = 1026;
const DEV_SMTP_FROM = 'no-reply@localhost';

/**
 * The values `SMTP_TLS` accepts. The auth plugin gives them their meaning; the type only checks that each one is a
 * mode the plugin knows, so a mode added there is added here by hand.
 */
const SMTP_TLS_MODES = ['none', 'starttls', 'implicit'] as const satisfies readonly SmtpTlsMode[];
/** The port on which SMTP is TLS from the first byte. */
const SMTPS_PORT = 465;
/** The submission port, which starts plain and upgrades with STARTTLS. */
const SUBMISSION_PORT = 587;
/** The mode each conventional port cannot carry; every other port takes any mode. */
const CONTRADICTED_TLS_BY_PORT: ReadonlyMap<number, { readonly mode: SmtpTlsMode; readonly portRole: string }> =
  new Map([
    [SMTPS_PORT, { mode: 'starttls', portRole: 'the implicit TLS port' }],
    [SUBMISSION_PORT, { mode: 'implicit', portRole: 'the STARTTLS port' }],
  ]);
/** Hosts a clear-text password reaches without leaving the machine or the compose network: loopback and Mailpit. */
const LOCAL_SMTP_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1', 'mailpit'];
const LOCALHOST_SUFFIX = '.localhost';

/**
 * The provider endpoints a deployment may override. The server sends each one a secret (the Turnstile key, an
 * OAuth client secret) or a user's token, or redirects a browser to it.
 */
const ENDPOINT_OVERRIDES = [
  'TURNSTILE_SITEVERIFY_URL',
  'GOOGLE_OAUTH_AUTHORIZE_URL',
  'GOOGLE_OAUTH_TOKEN_URL',
  'GOOGLE_OAUTH_USERINFO_URL',
  'FACEBOOK_OAUTH_AUTHORIZE_URL',
  'FACEBOOK_OAUTH_TOKEN_URL',
  'FACEBOOK_OAUTH_USERINFO_URL',
] as const;
const HTTPS_PROTOCOL = 'https:';
const WEB_PROTOCOLS: readonly string[] = ['http:', HTTPS_PROTOCOL];

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
  SMTP_USERNAME: text,
  SMTP_PASSWORD: text,
  SMTP_TLS: z.enum(SMTP_TLS_MODES).optional(),
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
  TURNSTILE_SITEVERIFY_URL: url,
};

type AuthEnv = z.infer<z.ZodObject<typeof authEnvShape>>;

/** The auth secrets, for the placeholder check. */
export function authSecretsOf(env: AuthEnv): [name: string, value: string | undefined][] {
  return [
    ['AUTH_TOKEN_SECRET', env.AUTH_TOKEN_SECRET],
    ['SMTP_PASSWORD', env.SMTP_PASSWORD],
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

const isLocalSmtpHost = (host: string): boolean => {
  const name = host.toLowerCase();
  return LOCAL_SMTP_HOSTS.includes(name) || name.endsWith(LOCALHOST_SUFFIX);
};

/**
 * `SMTP_TLS`, or its default: `implicit` on port 465, else `starttls` when deployed and `none` otherwise.
 * A deployed server never sends in clear unless told to; a development server reaches Mailpit with no setting.
 */
function smtpTlsOf(env: AuthEnv, deployed: boolean): SmtpTlsMode {
  if (env.SMTP_TLS !== undefined) {
    return env.SMTP_TLS;
  }
  if (env.SMTP_PORT === SMTPS_PORT) {
    return 'implicit';
  }
  return deployed ? 'starttls' : 'none';
}

/** A mode the port cannot speak would only show as a timeout on the first email, so it is refused here. */
function rejectContradictoryPortAndTls(env: AuthEnv, context: z.RefinementCtx): void {
  const port = env.SMTP_PORT ?? DEV_SMTP_PORT;
  const contradicted = CONTRADICTED_TLS_BY_PORT.get(port);
  if (contradicted === undefined || env.SMTP_TLS !== contradicted.mode) {
    return;
  }
  context.addIssue({
    code: 'custom',
    path: ['SMTP_TLS'],
    message: `${contradicted.mode} contradicts SMTP_PORT ${String(port)}, ${contradicted.portRole}`,
  });
}

/** The relay account is a username with its password, and the password never crosses a network in clear text. */
function requireSafeSmtpCredentials(env: AuthEnv, deployed: boolean, context: z.RefinementCtx): void {
  if (env.SMTP_USERNAME === undefined && env.SMTP_PASSWORD === undefined) {
    return;
  }
  if (env.SMTP_PASSWORD === undefined) {
    context.addIssue({ code: 'custom', path: ['SMTP_PASSWORD'], message: 'is required when SMTP_USERNAME is set' });
  }
  if (env.SMTP_USERNAME === undefined) {
    context.addIssue({ code: 'custom', path: ['SMTP_USERNAME'], message: 'is required when SMTP_PASSWORD is set' });
  }
  if (smtpTlsOf(env, deployed) === 'none' && !isLocalSmtpHost(env.SMTP_HOST ?? DEV_SMTP_HOST)) {
    context.addIssue({
      code: 'custom',
      path: ['SMTP_TLS'],
      message: 'must be starttls or implicit when SMTP credentials are set and SMTP_HOST is not a local host',
    });
  }
}

/** The message for an endpoint override, or undefined when the server may call it. */
function endpointIssue(value: string, deployed: boolean): string | undefined {
  if (!URL.canParse(value)) {
    // The schema's own URL check reports it; refinements still run on a value it refused.
    return undefined;
  }
  const { protocol } = new URL(value);
  if (!WEB_PROTOCOLS.includes(protocol)) {
    return 'must be an http:// or https:// URL';
  }
  return deployed && protocol !== HTTPS_PROTOCOL ? 'must be an https:// URL in this environment' : undefined;
}

/** A secret never leaves a deployed server in clear text; `http://` is for a mock on a development machine. */
function requireSafeEndpointOverrides(env: AuthEnv, deployed: boolean, context: z.RefinementCtx): void {
  for (const name of ENDPOINT_OVERRIDES) {
    const value = env[name];
    const message = value === undefined ? undefined : endpointIssue(value, deployed);
    if (message !== undefined) {
      context.addIssue({ code: 'custom', path: [name], message });
    }
  }
}

/** A switched-on feature needs its credentials, and a deployed server its real mail and dashboard addresses. */
export function requireAuthSettings(env: AuthEnv, deployed: boolean, context: z.RefinementCtx): void {
  if (deployed) {
    requireAll(env, DEPLOYED_REQUIRED, 'in this environment', context);
  }
  rejectContradictoryPortAndTls(env, context);
  requireSafeSmtpCredentials(env, deployed, context);
  requireSafeEndpointOverrides(env, deployed, context);
  if (env.AUTH_OAUTH_ENABLED) {
    requireAll(env, OAUTH_REQUIRED, 'when AUTH_OAUTH_ENABLED is true', context);
  }
  if (env.TURNSTILE_ENABLED) {
    requireAll(env, TURNSTILE_REQUIRED, 'when TURNSTILE_ENABLED is true', context);
  }
}

/** The settings {@link authDefaults} always resolves. */
type ResolvedAuthEnv = Required<
  Pick<AuthEnv, 'AUTH_DASHBOARD_URL' | 'SMTP_HOST' | 'SMTP_PORT' | 'SMTP_FROM' | 'SMTP_TLS'>
>;

/** The development fallbacks of the settings a deployed server must set, and the `SMTP_TLS` of {@link smtpTlsOf}. */
export function authDefaults(env: AuthEnv, deployed: boolean): ResolvedAuthEnv {
  return {
    AUTH_DASHBOARD_URL: env.AUTH_DASHBOARD_URL ?? DEV_AUTH_DASHBOARD_URL,
    SMTP_HOST: env.SMTP_HOST ?? DEV_SMTP_HOST,
    SMTP_PORT: env.SMTP_PORT ?? DEV_SMTP_PORT,
    SMTP_FROM: env.SMTP_FROM ?? DEV_SMTP_FROM,
    SMTP_TLS: smtpTlsOf(env, deployed),
  };
}
