import { CATALOG_MAX_PAGE_SIZE, COLLECTION_LIST_PAGE_SIZE, COLLECTION_MAX_MANUAL_PRODUCTS } from '@cod/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import {
  COLLECTION_PRODUCTS_QUERY_KEY,
  COLLECTION_QUERY_KEY,
  COLLECTIONS_QUERY_KEY,
  MEDIA_LIBRARY_QUERY_KEY,
  PRODUCT_SEARCH_QUERY_KEY,
  SLUG_QUERY_KEY,
} from './constants';
import type {
  CollectionMediaDto,
  StoreCollectionDto,
  StoreCollectionPageDto,
  StoreCollectionProductPageDto,
  StoreCollectionSlugDto,
} from './dto';
import { type StoreScope, storeQuery } from './model/store-query';

/** Every field of a collection the list and the editor read. */
export const COLLECTION_FIELDS = `
  id title slug description featuredAsset { id preview } mode visible position productCount
  rule { version match conditions { field operator option values min max value } }`;

const LIST_QUERY = `query StoreCollectionList($options: StoreCollectionListInput) {
  storeCollections(options: $options) { items { ${COLLECTION_FIELDS} } totalItems } }`;
const ONE_QUERY = `query StoreCollectionEditor($id: ID!) { storeCollection(id: $id) { ${COLLECTION_FIELDS} } }`;
const PRODUCTS_QUERY = `query StoreCollectionMembers($id: ID!, $options: StoreCollectionProductListInput) {
  storeCollectionProducts(id: $id, options: $options) { items { productId title status price } totalItems } }`;
const SEARCH_QUERY = `query StoreCollectionProductFinder($options: StoreCollectionProductSearchInput) {
  storeCollectionProductSearch(options: $options) { items { productId title status price } totalItems } }`;
const SLUG_QUERY = `query StoreCollectionSlugCheck($slug: String!, $collectionId: ID) {
  storeCollectionSlugAvailability(slug: $slug, collectionId: $collectionId) { slug available } }`;
const MEDIA_LIBRARY_QUERY = `query CollectionsMediaLibrary($options: CatalogMediaListInput) {
  catalogMedia(options: $options) { items { id assetId previewUrl } } }`;

/** A page of the list: its number (from 1) and the title search. */
export interface CollectionListQuery {
  readonly page: number;
  readonly search: string;
}

/** One page of the active store's collections, searched by title (D2325). */
export function useStoreCollections(scope: StoreScope | null, query: CollectionListQuery) {
  const search = query.search.trim();
  const options = {
    skip: (query.page - 1) * COLLECTION_LIST_PAGE_SIZE,
    take: COLLECTION_LIST_PAGE_SIZE,
    ...(search === '' ? {} : { search }),
  };
  return useQuery(
    storeQuery(
      COLLECTIONS_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly storeCollections: StoreCollectionPageDto }>(LIST_QUERY, { options }))
          .storeCollections,
      options,
    ),
  );
}

/** The collection the editor opens, `null` when the active store has no such collection. */
export function useStoreCollection(scope: StoreScope | null, collectionId: string) {
  return useQuery(
    storeQuery(
      COLLECTION_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly storeCollection: StoreCollectionDto | null }>(ONE_QUERY, { id: collectionId }))
          .storeCollection,
      { collectionId },
    ),
  );
}

/** Every product of the collection in its order (a manual collection holds at most 500, D2322). */
export function useCollectionProducts(scope: StoreScope | null, collectionId: string) {
  return useQuery(
    storeQuery(
      COLLECTION_PRODUCTS_QUERY_KEY,
      scope,
      async () =>
        (
          await api.query<{ readonly storeCollectionProducts: StoreCollectionProductPageDto }>(PRODUCTS_QUERY, {
            id: collectionId,
            options: { skip: 0, take: COLLECTION_MAX_MANUAL_PRODUCTS },
          })
        ).storeCollectionProducts,
      { collectionId },
    ),
  );
}

/** The store's products whose title holds `search`, to add to a manual collection (D2321); needs the edit key. */
export function useProductSearch(scope: StoreScope | null, search: string) {
  const text = search.trim();
  const options = { take: COLLECTION_LIST_PAGE_SIZE, ...(text === '' ? {} : { search: text }) };
  return useQuery(
    storeQuery(
      PRODUCT_SEARCH_QUERY_KEY,
      scope,
      async () =>
        (
          await api.query<{ readonly storeCollectionProductSearch: StoreCollectionProductPageDto }>(SEARCH_QUERY, {
            options,
          })
        ).storeCollectionProductSearch,
      options,
    ),
  );
}

/** Whether `slug` is free in the active store for this collection (D2319); waits while the slug is empty. */
export function useSlugAvailability(scope: StoreScope | null, slug: string, collectionId: string | null) {
  return useQuery({
    ...storeQuery(
      SLUG_QUERY_KEY,
      scope,
      async () =>
        (
          await api.query<{ readonly storeCollectionSlugAvailability: StoreCollectionSlugDto }>(SLUG_QUERY, {
            slug,
            collectionId,
          })
        ).storeCollectionSlugAvailability,
      { slug, collectionId },
    ),
    enabled: slug.trim() !== '',
  });
}

/** The newest images of catalog's library, for the image card; asked only with catalog's view key (D2320). */
export function useMediaLibrary(scope: StoreScope | null, allowed: boolean) {
  return useQuery({
    ...storeQuery(
      MEDIA_LIBRARY_QUERY_KEY,
      scope,
      async () =>
        (
          await api.query<{ readonly catalogMedia: { readonly items: readonly CollectionMediaDto[] } }>(
            MEDIA_LIBRARY_QUERY,
            { options: { take: CATALOG_MAX_PAGE_SIZE } },
          )
        ).catalogMedia.items,
    ),
    enabled: allowed,
  });
}
