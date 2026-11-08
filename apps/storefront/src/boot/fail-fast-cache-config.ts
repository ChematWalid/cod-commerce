import { CacheConfigError, readCacheConfig } from '../../cache/cache-config';

/** The exit code of a storefront that cannot start with its configuration. */
export const CONFIG_ERROR_EXIT_CODE = 1;

/** The structured log event written just before that exit. */
export const CONFIG_INVALID_EVENT = 'storefront.config_invalid';

/**
 * Exits the process when the cache configuration is invalid (a missing `REDIS_URL` or `NEXT_DEPLOYMENT_ID`
 * outside development). Without it a production server stays up and answers 500 to every request, even
 * `/livez`; exiting lets the orchestrator (compose `restart: unless-stopped`) surface and retry it.
 *
 * @throws whatever {@link readCacheConfig} throws other than a {@link CacheConfigError}
 */
export function failFastOnInvalidCacheConfig(env: NodeJS.Dict<string>): void {
  try {
    readCacheConfig(env);
  } catch (error) {
    if (!(error instanceof CacheConfigError)) throw error;
    console.error(JSON.stringify({ level: 'fatal', event: CONFIG_INVALID_EVENT, error: error.message }));
    process.exit(CONFIG_ERROR_EXIT_CODE);
  }
}
