import type { PlatformLanguageCode } from '../platform/platform-defaults';

/** First path segment of every tenant render; the proxy refuses it from outside (`/_t`, `/%5f…`). */
export const TENANT_ROUTE_SEGMENT = '_t';

/** Where a tenant render lives: locale first so `[locale]` is the root layout, then the store and its host binding. */
export interface TenantRoute {
  readonly locale: PlatformLanguageCode;
  readonly storeId: string;
  /** The HMAC of (store, host) the proxy computes and the tenant layout checks (D3202). */
  readonly binding: string;
}

/**
 * The internal path the proxy rewrites a buyer path to (D3202): `/_t/{locale}/{storeId}/{binding}{path}`.
 *
 * @param path - the buyer's path, starting with `/`; the home page `/` maps to the tenant root.
 */
export function tenantRoutePath(route: TenantRoute, path: string): string {
  const rest = path === '/' ? '' : path;
  return `/${TENANT_ROUTE_SEGMENT}/${route.locale}/${route.storeId}/${route.binding}${rest}`;
}

/** Buyer-facing storefront pages, as a buyer types them on the store's host. */
export const STOREFRONT_PAGE_PATHS = {
  home: '/',
  products: '/products',
  product: '/product',
  category: '/category',
  search: '/search',
  cart: '/cart',
  checkout: '/checkout',
  success: '/success',
} as const;

/**
 * The api's public storefront REST routes (HMAC-signed by the storefront, D111). `productSearch` is declared before
 * the `product/:slug` handler, so a product slug can never be `search`.
 */
export const STOREFRONT_API_ROUTES = {
  resolve: '/store/resolve',
  byId: '/store/by-id',
  products: '/store/products',
  productSearch: '/store/product/search',
  product: '/store/product',
  collections: '/store/collections',
  collection: '/store/collection',
} as const;

/** The storefront route the api's revalidate worker calls, signed (D3211). */
export const STOREFRONT_REVALIDATE_PATH = '/api/internal/revalidate';

/** A storefront api route that takes one trailing parameter. */
export type StorefrontParamRoute = 'byId' | 'product' | 'collection';

/** `route` with `param` as one encoded trailing segment: a `/` or `..` in it can never reach another route. */
export function storefrontApiPath(route: StorefrontParamRoute, param: string): string {
  return `${STOREFRONT_API_ROUTES[route]}/${encodeURIComponent(param)}`;
}
