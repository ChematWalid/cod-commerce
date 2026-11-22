import { STOREFRONT_PAGE_PATHS } from '@cod/shared';

/** The header Cloudflare reads for its own cache only; browsers never see it as a caching instruction (ADR 0006). */
export const CDN_CACHE_CONTROL_HEADER = 'Cloudflare-CDN-Cache-Control';

/** A tenant page at the edge: a minute fresh, then served stale for ten minutes while it is refetched (ADR 0006 §4). */
export const TENANT_PAGE_CDN_CACHE_CONTROL = 'max-age=60, stale-while-revalidate=600';

/** Search results depend on the query and are never stored, at the edge or in the shared cache (D3214). */
export const UNCACHED_CDN_CACHE_CONTROL = 'no-store';

/** Pages whose responses the edge must not store, as a buyer types them. */
const UNCACHED_PAGE_PATHS: readonly string[] = [STOREFRONT_PAGE_PATHS.search];

function isUnder(pathname: string, page: string): boolean {
  return pathname === page || pathname.startsWith(`${page}/`);
}

/** The edge caching rule of a buyer path. */
export function cdnCacheControlOf(pathname: string): string {
  const uncached = UNCACHED_PAGE_PATHS.some((page) => isUnder(pathname, page));
  return uncached ? UNCACHED_CDN_CACHE_CONTROL : TENANT_PAGE_CDN_CACHE_CONTROL;
}
