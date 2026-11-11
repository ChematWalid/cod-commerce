import { loadStorefrontEnv, StorefrontEnvError } from '../config/storefront-env';

/** The exit code of a storefront that cannot start with its configuration. */
export const CONFIG_ERROR_EXIT_CODE = 1;

/** The structured log event written just before that exit. */
export const CONFIG_INVALID_EVENT = 'storefront.config_invalid';

/**
 * Exits the process when the environment is invalid: a missing `REDIS_URL` or `NEXT_DEPLOYMENT_ID` outside
 * development, or a missing or malformed `INTERNAL_API_URL`. Without it a production server stays up, reports
 * ready and answers 500 to every page; exiting lets the orchestrator (compose `restart: unless-stopped`)
 * surface and retry it.
 *
 * @throws whatever {@link loadStorefrontEnv} throws other than a {@link StorefrontEnvError}
 */
export function failFastOnInvalidEnv(env: NodeJS.Dict<string>): void {
  try {
    loadStorefrontEnv(env);
  } catch (error) {
    if (!(error instanceof StorefrontEnvError)) throw error;
    console.error(JSON.stringify({ level: 'fatal', event: CONFIG_INVALID_EVENT, issues: error.issues }));
    process.exit(CONFIG_ERROR_EXIT_CODE);
  }
}
