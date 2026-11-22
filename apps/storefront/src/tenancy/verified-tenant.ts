import { isPlatformLanguageCode, isSnowflake, type PlatformLanguageCode, type StorefrontStore } from '@cod/shared';
import type { InternalSigningKey } from '@cod/shared/internal-auth';
import { normalizeHost } from './host';
import { isHostBindingValid } from './host-binding';

/** The route params of a tenant render (`/_t/{locale}/{storeId}/{binding}`), untrusted until verified. */
export interface TenantRouteParams {
  readonly locale: string;
  readonly storeId: string;
  readonly binding: string;
}

declare const verifiedTenantBrand: unique symbol;

/** What a verified tenant carries, before the brand that only the verifier adds. */
interface TenantFields {
  readonly storeId: string;
  readonly locale: PlatformLanguageCode;
  readonly store: StorefrontStore;
}

/**
 * A store whose tenant path carried a valid host binding for its own primary host and its own language (#209).
 * Only {@link createTenantVerifier} produces one, and every storefront data loader takes one, so a crafted path
 * naming another store renders no store data.
 */
export interface VerifiedTenant extends TenantFields {
  readonly [verifiedTenantBrand]: true;
}

/** What the verifier reads: the store by id and the configured internal keys. */
export interface TenantVerifierDeps {
  readonly loadStore: (storeId: string) => Promise<StorefrontStore | null>;
  readonly verifyKeys: () => readonly InternalSigningKey[];
}

/** Checks tenant route params; resolves `null` when they do not name a store reached through its own host. */
export type TenantVerifier = (params: TenantRouteParams) => Promise<VerifiedTenant | null>;

function bindsToOwnHost(store: StorefrontStore, params: TenantRouteParams, deps: TenantVerifierDeps): boolean {
  const primaryHost = normalizeHost(store.primaryHost);
  if (primaryHost === null || store.storeId !== params.storeId) return false;
  return isHostBindingValid(deps.verifyKeys(), store.storeId, primaryHost, params.binding);
}

/**
 * The tenant check of the tenant layout and pages. A malformed store id or locale is refused before any api call
 * (the build's prerender sentinel included); the store must exist, speak the path's locale, and the binding must be
 * the one of its primary host under any configured key.
 */
export function createTenantVerifier(deps: TenantVerifierDeps): TenantVerifier {
  return async (params) => {
    if (!isSnowflake(params.storeId) || !isPlatformLanguageCode(params.locale)) return null;
    const store = await deps.loadStore(params.storeId);
    if (store === null || store.language !== params.locale) return null;
    if (!bindsToOwnHost(store, params, deps)) return null;
    const fields: TenantFields = { storeId: store.storeId, locale: store.language, store };
    // The only place a VerifiedTenant is made: the brand exists in the type system alone.
    return fields as VerifiedTenant;
  };
}
