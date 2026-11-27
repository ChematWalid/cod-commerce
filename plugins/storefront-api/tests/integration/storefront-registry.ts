import { Permission } from '@vendure/core';

/** What a route's sample is filled with: a product (slug and id) and a collection slug of some store. */
export interface StorefrontRouteFill {
  readonly productSlug: string;
  readonly productId: string;
  readonly collectionSlug: string;
}

/** One public storefront route and a call that reaches it with a real store's data. */
export interface StorefrontRoute {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  /** The route with its parameters filled. */
  readonly sample: (fill: StorefrontRouteFill) => string;
  /** The JSON body a POST route is called with. */
  readonly body?: (fill: StorefrontRouteFill) => unknown;
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
  {
    method: 'POST',
    path: '/store/shipping-quote',
    sample: () => '/store/shipping-quote',
    body: ({ productId }) => ({ provinceCode: '16', stopdesk: false, items: [{ productId, quantity: 1 }] }),
  },
];

/** What every route's `@Allow` must say. */
export const STOREFRONT_ROUTE_PERMISSION: string = Permission.Public;
