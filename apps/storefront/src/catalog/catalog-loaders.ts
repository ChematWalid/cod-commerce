import {
  collectionTag,
  offersTag,
  STOREFRONT_API_ROUTES,
  STOREFRONT_LIST_DEFAULT_TAKE,
  STOREFRONT_SEARCH_MIN_QUERY,
  storefrontApiPath,
  type StorefrontCollection,
  storefrontCollectionListSchema,
  type StorefrontCollectionPage,
  storefrontCollectionPageSchema,
  type StorefrontProduct,
  type StorefrontProductPage,
  storefrontProductPageSchema,
  storefrontProductSchema,
  productTag,
  storeTag,
} from '@cod/shared';
import { cacheLife, cacheTag } from 'next/cache';
import type { VerifiedTenant } from '../tenancy/verified-tenant';
import { fetchCatalog } from './catalog-api';
import {
  collectionPageWithAssetPaths,
  collectionWithAssetPath,
  pageWithAssetPaths,
  productWithAssetPaths,
} from './catalog-images';
import { type ListingQuery, listingApiQuery, type SearchQuery } from './listing-query';
import { routeSlugOf } from './slug';

/** A page with no products, for a listing the api has nothing for. */
function emptyPage(skip = 0): StorefrontProductPage {
  return { items: [], totalItems: 0, skip, take: STOREFRONT_LIST_DEFAULT_TAKE };
}

function tagProducts(page: StorefrontProductPage): void {
  if (page.items.length > 0) cacheTag(...page.items.map((item) => productTag(item.id)));
}

/**
 * One listing page of the store's listed products. Cached per store and query, tagged with the store and each
 * product shown, so a product change or a store change revalidates it (ADR 0006).
 *
 * @throws CatalogApiError when the api cannot answer
 */
export async function loadProductPage(tenant: VerifiedTenant, query: ListingQuery): Promise<StorefrontProductPage> {
  'use cache';
  cacheTag(storeTag(tenant.storeId));
  cacheLife('hours');
  const path = `${STOREFRONT_API_ROUTES.products}?${listingApiQuery(query)}`;
  const page = (await fetchCatalog(tenant, path, storefrontProductPageSchema)) ?? emptyPage();
  tagProducts(page);
  return pageWithAssetPaths(page);
}

/**
 * The product page of the route segment `slug` (decoded once), or `null` for a slug that is malformed (no api call),
 * unknown or hidden. Tagged with the product and the store's offers, which the product page shows (P3.S3).
 *
 * @throws CatalogApiError when the api cannot answer
 */
export async function loadProduct(tenant: VerifiedTenant, slug: string): Promise<StorefrontProduct | null> {
  'use cache';
  cacheTag(storeTag(tenant.storeId), offersTag(tenant.storeId));
  cacheLife('hours');
  const routeSlug = routeSlugOf(slug);
  if (routeSlug === null) return null;
  const product = await fetchCatalog(tenant, storefrontApiPath('product', routeSlug), storefrontProductSchema);
  if (product === null) return null;
  cacheTag(productTag(product.id));
  return productWithAssetPaths(product);
}

/**
 * The store's visible collections, by position, each image a storage path.
 *
 * @throws CatalogApiError when the api cannot answer
 */
export async function loadCollections(tenant: VerifiedTenant): Promise<readonly StorefrontCollection[]> {
  'use cache';
  cacheTag(storeTag(tenant.storeId));
  cacheLife('hours');
  const list = await fetchCatalog(tenant, STOREFRONT_API_ROUTES.collections, storefrontCollectionListSchema);
  const items = list?.items ?? [];
  if (items.length > 0) cacheTag(...items.map((collection) => collectionTag(collection.id)));
  return items.map(collectionWithAssetPath);
}

/**
 * A collection and one listing page of its products, or `null` for a malformed (no api call), unknown or hidden
 * collection slug.
 *
 * @throws CatalogApiError when the api cannot answer
 */
export async function loadCollectionPage(
  tenant: VerifiedTenant,
  slug: string,
  query: ListingQuery,
): Promise<StorefrontCollectionPage | null> {
  'use cache';
  cacheTag(storeTag(tenant.storeId));
  cacheLife('hours');
  const routeSlug = routeSlugOf(slug);
  if (routeSlug === null) return null;
  const path = `${storefrontApiPath('collection', routeSlug)}?${listingApiQuery(query)}`;
  const page = await fetchCatalog(tenant, path, storefrontCollectionPageSchema);
  if (page === null) return null;
  cacheTag(collectionTag(page.collection.id));
  tagProducts(page.products);
  return collectionPageWithAssetPaths(page);
}

/**
 * One page of search results, read on every request and never stored in the shared cache (D3214). A query too short
 * to run answers an empty page without an api call. The buyer's `clientIp`, when known, is signed into the call so
 * the api limits searches per buyer rather than per store (D3213).
 *
 * @throws CatalogApiError when the api cannot answer
 */
export async function searchProducts(
  tenant: VerifiedTenant,
  search: SearchQuery,
  clientIp?: string,
): Promise<StorefrontProductPage> {
  const skip = (search.page - 1) * STOREFRONT_LIST_DEFAULT_TAKE;
  if (search.q.length < STOREFRONT_SEARCH_MIN_QUERY) return emptyPage(skip);
  const query = new URLSearchParams({ q: search.q, skip: String(skip), take: String(STOREFRONT_LIST_DEFAULT_TAKE) });
  const path = `${STOREFRONT_API_ROUTES.productSearch}?${query.toString()}`;
  const page = (await fetchCatalog(tenant, path, storefrontProductPageSchema, clientIp)) ?? emptyPage(skip);
  return pageWithAssetPaths(page);
}
