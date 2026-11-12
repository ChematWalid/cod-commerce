import { SESSION_DURATION } from '@cod/shared';
import type { AuthOptions } from '@vendure/core';
import { isDeployed } from './deployed-env';
import type { AppEnv } from './env';

/** Cookie sessions for the dashboard and storefront, bearer tokens for API clients (ADR 0008). */
export function buildAuthConfig(env: AppEnv): AuthOptions {
  return {
    tokenMethod: ['cookie', 'bearer'],
    sessionDuration: SESSION_DURATION,
    superadminCredentials: { identifier: env.SUPERADMIN_USERNAME, password: env.SUPERADMIN_PASSWORD },
    cookieOptions: {
      secret: env.COOKIE_SECRET,
      // Explicit, not inferred from the request and the proxy hops: Secure whenever deployed (TLS ends at the proxy),
      // off in development and test so the http dashboard and the browser suites keep their session (SRV-11).
      secure: isDeployed(env),
      httpOnly: true,
      // Lax: the storefront and the api share a site and the dashboard is reached by links, so Strict would drop it.
      sameSite: 'lax',
    },
  };
}
