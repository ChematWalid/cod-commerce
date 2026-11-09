import { type NextRequest, NextResponse } from 'next/server';
import { normalizeHost } from './host';
import { isInternalPath, NOT_FOUND_PATH, TENANT_PATH_PREFIX } from './internal-paths';
import type { ResolvedStore } from './store-resolver';

const MOVED_PERMANENTLY = 301;

/** The internal path of a store's page: `/_t/demo/ar` + `pathname`, with `/` adding nothing. */
export function toTenantPath(store: ResolvedStore, pathname: string): string {
  const suffix = pathname === '/' ? '' : pathname;
  return `${TENANT_PATH_PREFIX}/${store.storeId}/${store.defaultLocale}${suffix}`;
}

/** The URL a buyer on a secondary host is sent to: same path and query, the store's primary host. */
function primaryHostUrl(request: NextRequest, store: ResolvedStore): URL {
  const url = request.nextUrl.clone();
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto === 'https' || forwardedProto === 'http') url.protocol = `${forwardedProto}:`;
  url.hostname = store.primaryHost;
  url.port = /:(\d+)$/.exec(request.headers.get('host') ?? '')?.[1] ?? '';
  return url;
}

/**
 * Answers a request for a store: a 301 to its primary host when asked on another one, otherwise a rewrite to its
 * internal path in the store's default locale. No store, or a public request for an internal path, rewrites to
 * the not-found page.
 */
export function rewriteToTenantPath(request: NextRequest, store: ResolvedStore | null): NextResponse {
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();
  if (!store || isInternalPath(pathname)) {
    url.pathname = NOT_FOUND_PATH;
    return NextResponse.rewrite(url);
  }
  if (normalizeHost(request.headers.get('host')) !== store.primaryHost) {
    return NextResponse.redirect(primaryHostUrl(request, store), MOVED_PERMANENTLY);
  }
  url.pathname = toTenantPath(store, pathname);
  return NextResponse.rewrite(url);
}
