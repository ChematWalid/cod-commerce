import type { AuthOptions } from '@vendure/core';
import type { AppEnv } from './env';

/** Cookie sessions for the dashboard and storefront, bearer tokens for API clients (ADR 0008). */
export function buildAuthConfig(env: AppEnv): AuthOptions {
  return {
    tokenMethod: ['cookie', 'bearer'],
    superadminCredentials: { identifier: env.SUPERADMIN_USERNAME, password: env.SUPERADMIN_PASSWORD },
    cookieOptions: { secret: env.COOKIE_SECRET },
  };
}
