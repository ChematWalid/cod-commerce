import { CATALOG_MAX_PAGE_SIZE } from '@cod/shared';
import { skipToken, useQuery } from '@tanstack/react-query';
import { api, LS_KEY_SELECTED_CHANNEL_TOKEN } from '@vendure/dashboard';
import {
  BRANDS_QUERY_KEY,
  COLLECTION_OPTIONS_QUERY_KEY,
  EFFECTIVE_PERMISSIONS_QUERY_KEY,
  MEDIA_PREVIEWS_QUERY_KEY,
  PRODUCTS_QUERY_KEY,
  TAGS_QUERY_KEY,
} from './constants';
import { fetchForStore, retriesStoreSwitch } from './model/store-bound-fetch';
import { placeholderWithinStore } from './model/store-placeholder';
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
        settings {
          soldOut
          allowOutOfStockOrders
        }
      }
      totalItems
    }
  }
`;

const BRANDS_QUERY = 'query CatalogBrandOptions { catalogBrands { id name } }';
const TAGS_QUERY = 'query CatalogTagOptions { catalogTags { id name } }';
const COLLECTION_OPTIONS_QUERY = 'query CatalogCollectionFilterOptions { catalogCollectionOptions { id title } }';
const MEDIA_PREVIEWS_QUERY = `query CatalogMediaPreviews($options: CatalogMediaListInput) {
  catalogMedia(options: $options) { items { assetId previewUrl } } }`;
const EFFECTIVE_PERMISSIONS_QUERY = 'query CatalogEffectivePermissions { effectivePermissions { permissions } }';

/**
 * The store a query answers for: its id goes in the key, its channel token is what the answer must be fetched with.
 * A store switch refetches the mounted queries with the new token while they are still keyed by the old store, so an
 * answer fetched with another token is dropped ({@link fetchForStore}) instead of cached under this store.
 */
export interface StoreScope {
  readonly storeId: string;
  readonly channelToken: string;
}

/** The channel token requests are sent with, or null when the browser's storage cannot be read or holds none. */
export function readRequestToken(): string | null {
  try {
    return localStorage.getItem(LS_KEY_SELECTED_CHANNEL_TOKEN);
  } catch (error: unknown) {
    console.error('Could not read the selected channel token', error);
    return null;
  }
}

/**
 * A query of `scope`'s store, keyed by it and waiting while the store is unknown. While a new key loads it shows the
 * previous answer only if that answer is of the same store ({@link placeholderWithinStore}). Only a dropped answer of
 * a switched store is retried ({@link retriesStoreSwitch}).
 */
export function storeQuery<T>(
  prefix: readonly string[],
  scope: StoreScope | null,
  fetchAnswer: () => Promise<T>,
  extra = {},
) {
  return {
    queryKey: [...prefix, scope?.storeId ?? null, extra],
    queryFn: scope === null ? skipToken : () => fetchForStore(scope.channelToken, readRequestToken, fetchAnswer),
    placeholderData: placeholderWithinStore(prefix.length, scope?.storeId ?? null)<T>,
    retry: retriesStoreSwitch,
  } as const;
}

/** One page of the active store's products under the tab, search and filters of `options` (AC4). */
export function useCatalogProducts(scope: StoreScope | null, options: CatalogProductListInput) {
  return useQuery(
    storeQuery(
      PRODUCTS_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly catalogProducts: CatalogProductPageDto }>(PRODUCTS_QUERY, { options }))
          .catalogProducts,
      options,
    ),
  );
}

export function useCatalogBrands(scope: StoreScope | null) {
  return useQuery(
    storeQuery(
      BRANDS_QUERY_KEY,
      scope,
      async () => (await api.query<{ readonly catalogBrands: readonly CatalogNamedDto[] }>(BRANDS_QUERY)).catalogBrands,
    ),
  );
}

export function useCatalogTags(scope: StoreScope | null) {
  return useQuery(
    storeQuery(
      TAGS_QUERY_KEY,
      scope,
      async () => (await api.query<{ readonly catalogTags: readonly CatalogNamedDto[] }>(TAGS_QUERY)).catalogTags,
    ),
  );
}

/**
 * The store's collections for the list's Collection filter, from catalog's own query (D2324): empty while no plugin
 * provides collections. Named like brands and tags, so the filter reads them the same way.
 */
export function useCatalogCollectionOptions(scope: StoreScope | null) {
  return useQuery(
    storeQuery(COLLECTION_OPTIONS_QUERY_KEY, scope, async () => {
      const answer = await api.query<{
        readonly catalogCollectionOptions: readonly { readonly id: string; readonly title: string }[];
      }>(COLLECTION_OPTIONS_QUERY);
      return answer.catalogCollectionOptions.map(({ id, title }): CatalogNamedDto => ({ id, name: title }));
    }),
  );
}

/**
 * The previews of the newest library images, by asset id, for the list's thumbnails. Products only name their image's
 * asset (`CatalogMediaRef`), so an image past the first library page shows the empty thumbnail.
 */
export function useMediaPreviews(scope: StoreScope | null) {
  return useQuery(
    storeQuery(MEDIA_PREVIEWS_QUERY_KEY, scope, async () => {
      const answer = await api.query<{
        readonly catalogMedia: { readonly items: readonly CatalogMediaPreviewDto[] };
      }>(MEDIA_PREVIEWS_QUERY, { options: { take: CATALOG_MAX_PAGE_SIZE } });
      return new Map(answer.catalogMedia.items.map((item) => [item.assetId, item.previewUrl]));
    }),
  );
}

/**
 * What the server says the caller holds on the active store; empty until it answers for this store, so nothing shows
 * on a guess, not even a kept answer of an earlier key.
 */
export function useHeldPermissions(scope: StoreScope | null): ReadonlySet<string> {
  const { data, isSuccess, isPlaceholderData } = useQuery(
    storeQuery(EFFECTIVE_PERMISSIONS_QUERY_KEY, scope, () =>
      api.query<{ readonly effectivePermissions: { readonly permissions: readonly string[] } }>(
        EFFECTIVE_PERMISSIONS_QUERY,
      ),
    ),
  );
  return new Set(isSuccess && !isPlaceholderData ? data.effectivePermissions.permissions : []);
}
