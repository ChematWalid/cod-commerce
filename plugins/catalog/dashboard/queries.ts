import { CATALOG_MAX_PAGE_SIZE, type ProductStatus } from '@cod/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import {
  BRANDS_QUERY_KEY,
  EFFECTIVE_PERMISSIONS_QUERY_KEY,
  MEDIA_PREVIEWS_QUERY_KEY,
  PRODUCTS_QUERY_KEY,
  TAGS_QUERY_KEY,
} from './constants';
import type { CatalogMediaPreviewDto, CatalogNamedDto, CatalogProductListInput, CatalogProductPageDto } from './dto';

const PRODUCTS_QUERY = /* GraphQL */ `
  query CatalogProductList($options: CatalogProductListInput) {
    catalogProducts(options: $options) {
      items {
        id
        title
        status
        price
        featuredAsset {
          id
        }
        collectionIds
        createdAt
      }
      totalItems
    }
  }
`;

const BRANDS_QUERY = 'query CatalogBrandOptions { catalogBrands { id name } }';
const TAGS_QUERY = 'query CatalogTagOptions { catalogTags { id name } }';
const MEDIA_PREVIEWS_QUERY = `query CatalogMediaPreviews($options: CatalogMediaListInput) {
  catalogMedia(options: $options) { items { assetId previewUrl } } }`;
const EFFECTIVE_PERMISSIONS_QUERY = 'query CatalogEffectivePermissions { effectivePermissions { permissions } }';

const SET_STATUS_MUTATION = `mutation CatalogSetStatus($id: ID!, $status: CatalogProductStatus!) {
  setCatalogProductStatus(id: $id, status: $status) { id status } }`;
const DELETE_MUTATION = 'mutation CatalogDeleteProduct($id: ID!) { deleteCatalogProduct(id: $id) }';

/**
 * The store a query answers for, in its key: a store switch only marks the cache stale, so a key without it would show
 * the last store's rows and permissions under the new store until the refetch answers.
 */
export type StoreScope = string | null;

/** One page of the active store's products under the tab, search and filters of `options` (AC4). */
export function useCatalogProducts(scope: StoreScope, options: CatalogProductListInput) {
  return useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, scope, options],
    queryFn: async () =>
      (await api.query<{ readonly catalogProducts: CatalogProductPageDto }>(PRODUCTS_QUERY, { options }))
        .catalogProducts,
    retry: false,
  });
}

export function useCatalogBrands(scope: StoreScope) {
  return useQuery({
    queryKey: [...BRANDS_QUERY_KEY, scope],
    queryFn: async () =>
      (await api.query<{ readonly catalogBrands: readonly CatalogNamedDto[] }>(BRANDS_QUERY)).catalogBrands,
    retry: false,
  });
}

export function useCatalogTags(scope: StoreScope) {
  return useQuery({
    queryKey: [...TAGS_QUERY_KEY, scope],
    queryFn: async () =>
      (await api.query<{ readonly catalogTags: readonly CatalogNamedDto[] }>(TAGS_QUERY)).catalogTags,
    retry: false,
  });
}

/**
 * The previews of the newest library images, by asset id, for the list's thumbnails. Products only name their image's
 * asset (`CatalogMediaRef`), so an image past the first library page shows the empty thumbnail.
 */
export function useMediaPreviews(scope: StoreScope) {
  return useQuery({
    queryKey: [...MEDIA_PREVIEWS_QUERY_KEY, scope],
    queryFn: async () => {
      const answer = await api.query<{
        readonly catalogMedia: { readonly items: readonly CatalogMediaPreviewDto[] };
      }>(MEDIA_PREVIEWS_QUERY, { options: { take: CATALOG_MAX_PAGE_SIZE } });
      return new Map(answer.catalogMedia.items.map((item) => [item.assetId, item.previewUrl]));
    },
    retry: false,
  });
}

/** What the server says the caller holds on the active store; empty until it answers, so nothing shows on a guess. */
export function useHeldPermissions(scope: StoreScope): ReadonlySet<string> {
  const { data } = useQuery({
    queryKey: [...EFFECTIVE_PERMISSIONS_QUERY_KEY, scope],
    queryFn: () =>
      api.query<{ readonly effectivePermissions: { readonly permissions: readonly string[] } }>(
        EFFECTIVE_PERMISSIONS_QUERY,
      ),
    retry: false,
  });
  return new Set(data?.effectivePermissions.permissions ?? []);
}

export const setProductStatus = (id: string, status: ProductStatus): Promise<unknown> =>
  api.mutate(SET_STATUS_MUTATION, { id, status });
export const deleteProduct = (id: string): Promise<unknown> => api.mutate(DELETE_MUTATION, { id });
