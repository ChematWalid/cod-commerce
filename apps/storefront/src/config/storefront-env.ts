import { InvalidInternalKeysError, parseInternalKeys, type InternalSigningKey } from '@cod/shared/internal-auth';
import { CacheConfigError, requireDeploymentId, requireRedisUrl } from '../../cache/cache-config';

/**
 * The storefront's environment, validated once at boot (`instrumentation.ts`). It is hand-written because the
 * storefront has no schema library of its own and four variables do not justify adding one.
 *
 * The cache handlers are compiled apart from the app (`cache/tsconfig.json`) and Next loads them on their own,
 * so the two cache rules stay in `cache/cache-config.ts`; this module applies them and adds the rest.
 */

/** Every variable the storefront reads. The `.env.example` gate (`pnpm test:arch`) checks each one is documented. */
export const STOREFRONT_ENV_KEYS = [
  'APP_ENV',
  'NEXT_DEPLOYMENT_ID',
  'REDIS_URL',
  'INTERNAL_API_URL',
  'INTERNAL_HMAC_KEYS',
  'INTERNAL_HMAC_ACTIVE_KID',
  'PLATFORM_DOMAIN',
] as const;

const APP_ENVS: readonly string[] = ['development', 'test', 'staging', 'production'];
const API_URL_PROTOCOLS: readonly string[] = ['http:', 'https:'];
const REDIS_URL_PROTOCOLS: readonly string[] = ['redis:', 'rediss:'];
/** The environments that serve real stores: they must name their platform domain, never fall back. */
const DEPLOYED_APP_ENVS: readonly string[] = ['staging', 'production'];
/** The platform domain outside staging and production, so `*.localhost` stores work in development and CI. */
export const DEFAULT_PLATFORM_DOMAIN = 'localhost';
/** Lowercase DNS labels of 1-63 characters, dot-separated: no port, no trailing dot (the server's rule). */
const DNS_NAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const DNS_NAME_MAX_LENGTH = 253;

/** The validated, typed environment of the storefront. */
export interface StorefrontEnv {
  readonly redisUrl: string;
  readonly deploymentId: string;
  /** The API the proxy asks which store a host belongs to (D12). */
  readonly internalApiUrl: string;
  /** The key the storefront signs its API calls with (D111): the active kid of `INTERNAL_HMAC_KEYS`. */
  readonly internalSigningKey: InternalSigningKey;
  /** Stores live on `<label>.<platformDomain>`; any other host is answered 404 without an api call (D3214). */
  readonly platformDomain: string;
}

/** The environment is invalid. The issues name variables and rules, never values: a URL can hold a password. */
export class StorefrontEnvError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment: ${issues.join('; ')}`);
    this.name = 'StorefrontEnvError';
    this.issues = issues;
  }
}

const hasProtocol = (value: string, protocols: readonly string[]): boolean =>
  URL.canParse(value) && protocols.includes(new URL(value).protocol) && new URL(value).host !== '';

/** The issue of `INTERNAL_API_URL`, or undefined when it is a usable URL. */
function internalApiUrlIssue(url: string | undefined): string | undefined {
  if (!url) return 'INTERNAL_API_URL is required';
  if (!hasProtocol(url, API_URL_PROTOCOLS)) return 'INTERNAL_API_URL must be an http:// or https:// URL';
  return undefined;
}

/**
 * `INTERNAL_API_URL` alone, validated like the boot check validates it.
 *
 * @throws StorefrontEnvError when it is missing or not an http(s) URL
 */
export function readInternalApiUrl(env: NodeJS.Dict<string>): string {
  const url = env['INTERNAL_API_URL']?.trim();
  const issue = internalApiUrlIssue(url);
  if (issue !== undefined || url === undefined) throw new StorefrontEnvError([issue ?? 'INTERNAL_API_URL is required']);
  return url;
}

/**
 * The API of this process, for the store resolver. Read on each call, not once at load: the resolver's module is
 * also evaluated during `next build`, where the API does not exist. The boot check has already refused a bad value.
 *
 * @throws StorefrontEnvError when `INTERNAL_API_URL` is missing or not an http(s) URL
 */
export function internalApiUrl(): string {
  return readInternalApiUrl(process.env);
}

/** The platform domain and its issue, if any; the default applies outside staging and production. */
function platformDomainOf(env: NodeJS.Dict<string>): { domain: string; issue: string | undefined } {
  const domain = env['PLATFORM_DOMAIN']?.trim() ?? '';
  if (domain === '') {
    const appEnv = env['APP_ENV'] ?? '';
    if (!DEPLOYED_APP_ENVS.includes(appEnv)) return { domain: DEFAULT_PLATFORM_DOMAIN, issue: undefined };
    return { domain, issue: `PLATFORM_DOMAIN is required when APP_ENV is '${appEnv}'` };
  }
  if (domain.length > DNS_NAME_MAX_LENGTH || !DNS_NAME.test(domain)) {
    return { domain, issue: 'PLATFORM_DOMAIN must be a lowercase DNS name' };
  }
  return { domain, issue: undefined };
}

/**
 * `PLATFORM_DOMAIN` alone, validated like the boot check validates it.
 *
 * @throws StorefrontEnvError when it is missing in staging or production, or not a lowercase DNS name
 */
export function readPlatformDomain(env: NodeJS.Dict<string>): string {
  const { domain, issue } = platformDomainOf(env);
  if (issue !== undefined) throw new StorefrontEnvError([issue]);
  return domain;
}

/**
 * The platform domain of this process, for the store resolver. Read on each call, for the reason
 * {@link internalApiUrl} is.
 *
 * @throws StorefrontEnvError see {@link readPlatformDomain}
 */
export function platformDomain(): string {
  return readPlatformDomain(process.env);
}

/** The signing key and the issues of `INTERNAL_HMAC_KEYS` and `INTERNAL_HMAC_ACTIVE_KID`; issues never hold a secret. */
function signingKeyOf(env: NodeJS.Dict<string>): { key: InternalSigningKey | undefined; issues: string[] } {
  const issues: string[] = [];
  const keysValue = env['INTERNAL_HMAC_KEYS']?.trim();
  const activeKid = env['INTERNAL_HMAC_ACTIVE_KID']?.trim();
  let keys: readonly InternalSigningKey[] = [];
  if (!keysValue) {
    issues.push('INTERNAL_HMAC_KEYS is required');
  } else {
    try {
      keys = parseInternalKeys(keysValue);
    } catch (error) {
      if (!(error instanceof InvalidInternalKeysError)) throw error;
      issues.push(`INTERNAL_HMAC_KEYS is invalid (${error.message})`);
    }
  }
  if (!activeKid) {
    issues.push('INTERNAL_HMAC_ACTIVE_KID is required');
    return { key: undefined, issues };
  }
  const key = keys.find((candidate) => candidate.kid === activeKid);
  if (key === undefined && keys.length > 0)
    issues.push('INTERNAL_HMAC_ACTIVE_KID must be one of the kids in INTERNAL_HMAC_KEYS');
  return { key, issues };
}

/**
 * The key this process signs with, validated like the boot check validates it.
 *
 * @throws StorefrontEnvError when the keys or the active kid are missing or invalid (the message holds no secret)
 */
export function readInternalSigningKey(env: NodeJS.Dict<string>): InternalSigningKey {
  const { key, issues } = signingKeyOf(env);
  if (key === undefined || issues.length > 0) throw new StorefrontEnvError(issues);
  return key;
}

/**
 * The signing key of this process, for `internalFetch`. Read on each call, not once at load, for the reason
 * {@link internalApiUrl} is.
 *
 * @throws StorefrontEnvError when the keys or the active kid are missing or invalid
 */
export function internalSigningKey(): InternalSigningKey {
  return readInternalSigningKey(process.env);
}

/** The issues among `candidates` that are set. */
const presentIssues = (...candidates: (string | undefined)[]): string[] =>
  candidates.filter((issue): issue is string => issue !== undefined);

/** Runs a cache rule, turning its typed error into an issue; any other error is a bug and propagates. */
function cacheValue(read: () => string, issues: string[]): string {
  try {
    return read();
  } catch (error) {
    if (!(error instanceof CacheConfigError)) throw error;
    issues.push(error.message);
    return '';
  }
}

/**
 * Validates `env` and returns the typed environment.
 *
 * @throws StorefrontEnvError listing every invalid variable
 */
export function loadStorefrontEnv(env: NodeJS.Dict<string>): StorefrontEnv {
  const issues: string[] = [];
  const appEnv = env['APP_ENV'];
  if (appEnv !== undefined && !APP_ENVS.includes(appEnv)) {
    issues.push(`APP_ENV must be one of ${APP_ENVS.join(', ')}`);
  }
  const redisUrl = cacheValue(() => requireRedisUrl(env), issues);
  if (redisUrl !== '' && !hasProtocol(redisUrl, REDIS_URL_PROTOCOLS)) {
    issues.push('REDIS_URL must be a redis:// or rediss:// URL');
  }
  const deploymentId = cacheValue(() => requireDeploymentId(env), issues);
  const internalApiUrl = env['INTERNAL_API_URL']?.trim();
  const signing = signingKeyOf(env);
  const platform = platformDomainOf(env);
  issues.push(
    ...presentIssues(internalApiUrlIssue(internalApiUrl)),
    ...signing.issues,
    ...presentIssues(platform.issue),
  );
  if (issues.length > 0 || internalApiUrl === undefined || signing.key === undefined) {
    throw new StorefrontEnvError(issues);
  }
  return { redisUrl, deploymentId, internalApiUrl, internalSigningKey: signing.key, platformDomain: platform.domain };
}
