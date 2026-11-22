import { STOREFRONT_API_ROUTES, storefrontApiPath } from '@cod/shared';
import { isStorefrontSlug } from '../catalog/slug';

/** The api route behind each fixed client path of the same-origin store api. */
const FIXED_ROUTES: Readonly<Record<string, string>> = {
  products: STOREFRONT_API_ROUTES.products,
  'product/search': STOREFRONT_API_ROUTES.productSearch,
  collections: STOREFRONT_API_ROUTES.collections,
};

/** The client paths that take one slug, and the api route each one maps to. */
const SLUG_ROUTES: Readonly<Record<string, 'product' | 'collection'>> = {
  product: 'product',
  collection: 'collection',
};

/**
 * The api path behind the decoded segments of `/api/store/<segments>`, from a typed table: `products`,
 * `product/search`, `product/<slug>`, `collections`, `collection/<slug>`. Every segment must be a storefront slug
 * (no `.`, `%` or `/`), and the upstream path is built from the table with the slug encoded, never by joining the
 * client path, so no input can reach another api route.
 *
 * @returns the api path, or `null` for anything outside the table
 */
export function upstreamPathOf(segments: readonly string[]): string | null {
  if (segments.length === 0 || !segments.every(isStorefrontSlug)) return null;
  const key = segments.join('/');
  if (Object.hasOwn(FIXED_ROUTES, key)) return FIXED_ROUTES[key] ?? null;
  const [head = '', slug, ...rest] = segments;
  const route = Object.hasOwn(SLUG_ROUTES, head) ? SLUG_ROUTES[head] : undefined;
  if (route === undefined || slug === undefined || rest.length > 0) return null;
  return storefrontApiPath(route, slug);
}
