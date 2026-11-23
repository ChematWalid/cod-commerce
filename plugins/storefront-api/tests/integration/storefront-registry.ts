import { Permission } from '@vendure/core';

/** One public storefront route and a path that reaches it with a real store's data. */
export interface StorefrontRoute {
  readonly method: 'GET';
  readonly path: string;
  /** The route with its parameters filled, given a product slug and a collection slug of the signed store. */
  readonly sample: (fill: { readonly productSlug: string; readonly collectionSlug: string }) => string;
}

/**
 * Every route of the storefront API (D3201): all public (buyers have no session) and all behind the signed store.
 * The registry test checks it against the controllers; the isolation sweep calls each one as the wrong store.
 */
export const STOREFRONT_ROUTES: readonly StorefrontRoute[] = [
  { method: 'GET', path: '/store/products', sample: () => '/store/products' },
  { method: 'GET', path: '/store/product/search', sample: () => '/store/product/search?q=sweep' },
  { method: 'GET', path: '/store/product/:slug', sample: ({ productSlug }) => `/store/product/${productSlug}` },
  { method: 'GET', path: '/store/collections', sample: () => '/store/collections' },
  {
    method: 'GET',
    path: '/store/collection/:slug',
    sample: ({ collectionSlug }) => `/store/collection/${collectionSlug}`,
  },
];

/** What every route's `@Allow` must say. */
export const STOREFRONT_ROUTE_PERMISSION: string = Permission.Public;
