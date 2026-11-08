import { DEV_DEPLOYMENT_ID, DEV_REDIS_URL, DEVELOPMENT_APP_ENV } from './constants';

/** What the cache handlers need from the environment. */
export interface CacheConfig {
  readonly redisUrl: string;
  readonly deploymentId: string;
}

/** The environment cannot run the shared cache (a missing deployment id outside development). */
export class CacheConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheConfigError';
  }
}

/**
 * The deployment id that namespaces cache entries and `next build`'s assets (`NEXT_DEPLOYMENT_ID`).
 * It must be the same at build and at start, so outside development it is required, never guessed.
 *
 * @throws CacheConfigError when it is missing and `APP_ENV` is not `development`
 */
export function requireDeploymentId(env: NodeJS.Dict<string>): string {
  const deploymentId = env['NEXT_DEPLOYMENT_ID']?.trim();
  if (deploymentId) return deploymentId;
  if (env['APP_ENV'] === DEVELOPMENT_APP_ENV) return DEV_DEPLOYMENT_ID;
  throw new CacheConfigError(
    `NEXT_DEPLOYMENT_ID is required when APP_ENV is '${env['APP_ENV'] ?? ''}' (it defaults only in development)`,
  );
}

/**
 * Reads the cache configuration. `REDIS_URL` falls back to the host-run development Valkey: a wrong URL
 * degrades the cache to misses and shows up as `checks.redis.ok: false` on `/readyz`.
 *
 * @throws CacheConfigError see {@link requireDeploymentId}
 */
export function readCacheConfig(env: NodeJS.Dict<string>): CacheConfig {
  return { redisUrl: env['REDIS_URL']?.trim() || DEV_REDIS_URL, deploymentId: requireDeploymentId(env) };
}
