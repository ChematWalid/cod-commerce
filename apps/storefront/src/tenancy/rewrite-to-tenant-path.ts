import { tenantRoutePath } from '@cod/shared';
import { type NextRequest, NextResponse } from 'next/server';
import { BUYER_IP_QUERY_PARAM } from '../store-api/client-ip';
import { CDN_CACHE_CONTROL_HEADER, cdnCacheControlOf, isUncachedPage } from './cdn-cache-control';
import { normalizeHost, type NormalizedHost } from './host';
import { isInternalPath, NOT_FOUND_PATH } from './internal-paths';
import type { ResolvedStore } from './store-resolver';

const MOVED_PERMANENTLY = 301;

/** Signs the host binding of a store on a host (D3202); the proxy binds it to the active internal key. */
export type HostBinder = (storeId: string, host: NormalizedHost) => string;

/**
 * The internal path of a store's page: `/_t/{locale}/{storeId}/{binding}` + `pathname`, with `/` adding nothing.
 * The locale is the store's language, never the buyer's browser or a cookie (ADR 0005).
 */
export function toTenantPath(store: ResolvedStore, pathname: string, bindHost: HostBinder): string {
  const binding = bindHost(store.storeId, store.primaryHost);
  return tenantRoutePath({ locale: store.defaultLocale, storeId: store.storeId, binding }, pathname);
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
 * internal path in the store's default locale, with the edge caching rule of the page and never a cookie. No store,
 * or a public request for an internal or malformed path, rewrites to the not-found page. The edge's `buyerIp`, when
 * trusted, is handed to uncached pages only (search), so they can sign it into their api calls (D3213); a value the
 * client put in the query is always removed.
 */
export function rewriteToTenantPath(
  request: NextRequest,
  store: ResolvedStore | null,
  bindHost: HostBinder,
  buyerIp?: string,
): NextResponse {
  const { pathname } = request.nextUrl;
  const url = request.nextUrl.clone();
  url.searchParams.delete(BUYER_IP_QUERY_PARAM);
  if (!store || isInternalPath(pathname)) {
    url.pathname = NOT_FOUND_PATH;
    return NextResponse.rewrite(url);
  }
  if (normalizeHost(request.headers.get('host')) !== store.primaryHost) {
    return NextResponse.redirect(primaryHostUrl(request, store), MOVED_PERMANENTLY);
  }
  url.pathname = toTenantPath(store, pathname, bindHost);
  if (buyerIp !== undefined && isUncachedPage(pathname)) url.searchParams.set(BUYER_IP_QUERY_PARAM, buyerIp);
  const response = NextResponse.rewrite(url);
  response.headers.set(CDN_CACHE_CONTROL_HEADER, cdnCacheControlOf(pathname));
  return response;
}
