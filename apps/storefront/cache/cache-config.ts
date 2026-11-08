import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { DEV_DEPLOYMENT_ID, DEV_REDIS_URL, DEVELOPMENT_APP_ENV } from './constants';

/** What the cache handlers need from the environment. */
export interface CacheConfig {
  readonly redisUrl: string;
  readonly deploymentId: string;
}

/** The environment cannot run the shared cache (a missing deployment id or Valkey URL outside development). */
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

/** Whether this process is `next build`, which loads the cache handlers but never connects them. */
export function isNextBuildPhase(env: NodeJS.Dict<string>): boolean {
  return env['NEXT_PHASE'] === PHASE_PRODUCTION_BUILD;
}

/**
 * The Valkey URL (`REDIS_URL`). It falls back to the host-run development Valkey in development and during
 * `next build` (which opens no connection); anywhere else a missing URL is a configuration error, not a
 * silently cold cache.
 *
 * @throws CacheConfigError when it is missing outside development and outside `next build`
 */
export function requireRedisUrl(env: NodeJS.Dict<string>): string {
  const redisUrl = env['REDIS_URL']?.trim();
  if (redisUrl) return redisUrl;
  if (env['APP_ENV'] === DEVELOPMENT_APP_ENV || isNextBuildPhase(env)) return DEV_REDIS_URL;
  throw new CacheConfigError(`REDIS_URL is required when APP_ENV is '${env['APP_ENV'] ?? ''}'`);
}

/**
 * Reads the cache configuration.
 *
 * @throws CacheConfigError see {@link requireDeploymentId} and {@link requireRedisUrl}
 */
export function readCacheConfig(env: NodeJS.Dict<string>): CacheConfig {
  return { redisUrl: requireRedisUrl(env), deploymentId: requireDeploymentId(env) };
}
