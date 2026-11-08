import { type NextRequest, NextResponse } from 'next/server';
import { isInternalPath, NOT_FOUND_PATH, TENANT_PATH_PREFIX } from './internal-paths';
import type { ResolvedStore } from './store-resolver';

/** The internal path of a store's page: `/_t/demo/ar` + `pathname`, with `/` adding nothing. */
export function toTenantPath(store: ResolvedStore, pathname: string): string {
  const suffix = pathname === '/' ? '' : pathname;
  return `${TENANT_PATH_PREFIX}/${store.storeId}/${store.defaultLocale}${suffix}`;
}

/**
 * Rewrites a request to its store's internal path, in the store's default locale. No store, or a public
 * request for an internal path, rewrites to the not-found page. The 301 from a non-primary host to the
 * primary one belongs to P1.S1.
 */
export function rewriteToTenantPath(request: NextRequest, store: ResolvedStore | null): NextResponse {
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.pathname = store && !isInternalPath(pathname) ? toTenantPath(store, pathname) : NOT_FOUND_PATH;
  return NextResponse.rewrite(url);
}
