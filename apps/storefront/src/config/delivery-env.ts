/**
 * The storefront's delivery settings: where images and static assets are served from, whether the edge's buyer
 * address is trusted, and the Server Actions key. Validated at boot with the rest of the environment
 * (`loadStorefrontEnv`); issues name variables and rules, never values.
 */

/** The environments where Next may generate the Server Actions key itself, per build. */
const LOCAL_APP_ENVS: readonly string[] = ['development', 'test'];

/** The Server Actions key is AES-256-GCM: 32 bytes. */
const SERVER_ACTIONS_KEY_BYTES = 32;

const BASE64_FORMAT = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const URL_PROTOCOLS: readonly string[] = ['http:', 'https:'];
const BOOLEAN_VALUES: readonly string[] = ['true', 'false'];

const valueOf = (env: NodeJS.Dict<string>, key: string): string => env[key]?.trim() ?? '';

/** An optional URL or same-origin path (`/assets`); unset is fine. */
function urlOrPathIssue(env: NodeJS.Dict<string>, key: string): string | undefined {
  const value = valueOf(env, key);
  if (value === '' || (value.startsWith('/') && !value.startsWith('//'))) return undefined;
  if (URL.canParse(value) && URL_PROTOCOLS.includes(new URL(value).protocol)) return undefined;
  return `${key} must be an http(s) URL or a path starting with /`;
}

function trustEdgeIpIssue(env: NodeJS.Dict<string>): string | undefined {
  const value = valueOf(env, 'STOREFRONT_TRUST_EDGE_IP');
  return value === '' || BOOLEAN_VALUES.includes(value) ? undefined : 'STOREFRONT_TRUST_EDGE_IP must be true or false';
}

/**
 * Next encrypts Server Action closures with this key; without a fixed one each build and each instance generates
 * its own, so an action posted to another instance fails. Development and test may leave it to Next.
 */
function serverActionsKeyIssue(env: NodeJS.Dict<string>): string | undefined {
  const value = valueOf(env, 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY');
  if (value === '') {
    if (LOCAL_APP_ENVS.includes(env['APP_ENV'] ?? '')) return undefined;
    return 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is required unless APP_ENV is development or test';
  }
  const isKey = BASE64_FORMAT.test(value) && Buffer.from(value, 'base64').length === SERVER_ACTIONS_KEY_BYTES;
  return isKey ? undefined : 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY must be 32 bytes encoded in base64';
}

/** Every issue of the delivery settings, in a stable order. */
export function deliveryEnvIssues(env: NodeJS.Dict<string>): string[] {
  return [
    urlOrPathIssue(env, 'STOREFRONT_ASSET_BASE'),
    urlOrPathIssue(env, 'STOREFRONT_ASSET_PREFIX'),
    trustEdgeIpIssue(env),
    serverActionsKeyIssue(env),
  ].filter((issue): issue is string => issue !== undefined);
}

/** Whether `env` trusts `CF-Connecting-IP` (the storefront runs behind Cloudflare, D3213); unset means no. */
export function readTrustEdgeIp(env: NodeJS.Dict<string>): boolean {
  return valueOf(env, 'STOREFRONT_TRUST_EDGE_IP') === 'true';
}
