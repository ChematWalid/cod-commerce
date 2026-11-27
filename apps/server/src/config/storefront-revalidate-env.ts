import type { StorefrontTarget } from '@cod/plugin-storefront-api';
import { InvalidInternalKeysError, parseInternalKeys } from '@cod/shared/internal-auth';
import { z } from 'zod';

const HTTP_PROTOCOLS: readonly string[] = ['http:', 'https:'];

const isHttpUrl = (value: string): boolean => URL.canParse(value) && HTTP_PROTOCOLS.includes(new URL(value).protocol);

/** The variable of the storefront revalidation (D3211, D3222), spread into the server's schema. */
export const storefrontRevalidateEnvShape = {
  // The storefront as the api's worker reaches it (compose: http://storefront:3001), without the route. Unset or
  // blank: catalog and store changes are logged, not sent, and storefront pages expire by their cache life.
  STOREFRONT_INTERNAL_URL: z.string().refine(isHttpUrl, 'must be an http:// or https:// URL').optional(),
};

/** The parts of the environment the revalidation reads. */
interface StorefrontRevalidateEnv {
  readonly STOREFRONT_INTERNAL_URL?: string | undefined;
  readonly INTERNAL_HMAC_KEYS: string;
  readonly INTERNAL_HMAC_ACTIVE_KID?: string | undefined;
}

/** The api signs its storefront calls with the active internal key, so a set storefront needs the kid. */
export function requireRevalidateSigningKey(env: StorefrontRevalidateEnv, context: z.RefinementCtx): void {
  if (env.STOREFRONT_INTERNAL_URL === undefined || env.INTERNAL_HMAC_ACTIVE_KID !== undefined) return;
  context.addIssue({
    code: 'custom',
    path: ['INTERNAL_HMAC_ACTIVE_KID'],
    message: 'is required when STOREFRONT_INTERNAL_URL is set: the api signs its revalidations with it',
  });
}

/**
 * Where `StorefrontApiPlugin` sends revalidations, or `undefined` when no storefront is configured. `loadEnv` has
 * already checked the URL, the keys and that the active kid names one of them.
 */
export function storefrontTargetOf(env: StorefrontRevalidateEnv): StorefrontTarget | undefined {
  const internalUrl = env.STOREFRONT_INTERNAL_URL;
  if (internalUrl === undefined) return undefined;
  const signingKey = activeKeyOf(env);
  return signingKey === undefined ? undefined : { internalUrl, signingKey };
}

function activeKeyOf(env: StorefrontRevalidateEnv): StorefrontTarget['signingKey'] | undefined {
  try {
    return parseInternalKeys(env.INTERNAL_HMAC_KEYS).find((key) => key.kid === env.INTERNAL_HMAC_ACTIVE_KID);
  } catch (error) {
    if (error instanceof InvalidInternalKeysError) return undefined;
    throw error;
  }
}
