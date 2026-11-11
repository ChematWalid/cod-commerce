import { CacheConfigError, requireDeploymentId, requireRedisUrl } from '../../cache/cache-config';

/**
 * The storefront's environment, validated once at boot (`instrumentation.ts`). It is hand-written because the
 * storefront has no schema library of its own and four variables do not justify adding one.
 *
 * The cache handlers are compiled apart from the app (`cache/tsconfig.json`) and Next loads them on their own,
 * so the two cache rules stay in `cache/cache-config.ts`; this module applies them and adds the rest.
 */

/** Every variable the storefront reads. The `.env.example` gate (`pnpm test:arch`) checks each one is documented. */
export const STOREFRONT_ENV_KEYS = ['APP_ENV', 'NEXT_DEPLOYMENT_ID', 'REDIS_URL', 'INTERNAL_API_URL'] as const;

const APP_ENVS: readonly string[] = ['development', 'test', 'staging', 'production'];
const API_URL_PROTOCOLS: readonly string[] = ['http:', 'https:'];
const REDIS_URL_PROTOCOLS: readonly string[] = ['redis:', 'rediss:'];

/** The validated, typed environment of the storefront. */
export interface StorefrontEnv {
  readonly redisUrl: string;
  readonly deploymentId: string;
  /** The API the proxy asks which store a host belongs to (D12). */
  readonly internalApiUrl: string;
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
 * `INTERNAL_API_URL` alone, for the store resolver: it reads per request because its module is also evaluated
 * during `next build`, where the API does not exist. The boot check has already refused a bad value.
 *
 * @throws StorefrontEnvError when it is missing or not an http(s) URL
 */
export function readInternalApiUrl(env: NodeJS.Dict<string>): string {
  const url = env['INTERNAL_API_URL']?.trim();
  const issue = internalApiUrlIssue(url);
  if (issue !== undefined || url === undefined) throw new StorefrontEnvError([issue ?? 'INTERNAL_API_URL is required']);
  return url;
}

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
  const apiIssue = internalApiUrlIssue(internalApiUrl);
  if (apiIssue !== undefined) issues.push(apiIssue);
  if (issues.length > 0 || internalApiUrl === undefined) throw new StorefrontEnvError(issues);
  return { redisUrl, deploymentId, internalApiUrl };
}
