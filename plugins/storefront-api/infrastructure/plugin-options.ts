import type { InternalSigningKey } from '@cod/shared/internal-auth';
import type { CloudflarePurgeTarget } from './cloudflare-cdn-purge.adapter';

/** Where the api reaches the storefront for revalidations (D3211). */
export interface StorefrontTarget {
  /** `STOREFRONT_INTERNAL_URL`, without the route. */
  readonly internalUrl: string;
  /** The active internal key the calls are signed with. */
  readonly signingKey: InternalSigningKey;
}

/** What the host passes to `StorefrontApiPlugin.init`; every field is optional so plugin tests register it bare. */
export interface StorefrontApiPluginOptions {
  /** Stores live on `<subdomain>.<platformDomain>`: the hostnames a CDN purge names. Default `localhost`. */
  readonly platformDomain?: string;
  /** Unset: revalidations are logged, not sent (D3222). */
  readonly storefront?: StorefrontTarget;
  /** Unset: CDN purges are logged, not sent, and pages leave the CDN by their 60 s edge TTL (D3210). */
  readonly cloudflare?: CloudflarePurgeTarget;
}

/** The platform domain when the host names none: the development one. */
export const DEFAULT_PURGE_PLATFORM_DOMAIN = 'localhost';
