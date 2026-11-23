import { internalVerifyKeys } from '../config/storefront-env';
import { loadStore } from '../store/load-store';
import { PRERENDER_SENTINEL_STORE_ID } from './store-resolver';
import { createTenantVerifier, type TenantRouteParams, type TenantVerifier } from './verified-tenant';

/** The binding `generateStaticParams` returns next to the sentinel store id; no real binding has this form. */
export const PRERENDER_SENTINEL_BINDING = 'prerender-sentinel';

/** The tenant check the tenant layout and pages run: cached store by id, every configured internal key. */
export const verifyTenant: TenantVerifier = createTenantVerifier({ loadStore, verifyKeys: internalVerifyKeys });

/** The build's prerender of the tenant routes: it has no api to call, so it renders nothing (not a 404). */
export function isPrerenderSentinel(params: TenantRouteParams): boolean {
  return params.storeId === PRERENDER_SENTINEL_STORE_ID;
}
