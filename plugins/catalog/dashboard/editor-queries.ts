import { CATALOG_MAX_PAGE_SIZE } from '@cod/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import {
  HIGHLIGHTS_QUERY_KEY,
  MEDIA_LIBRARY_QUERY_KEY,
  ORDER_MANAGERS_QUERY_KEY,
  PRODUCT_QUERY_KEY,
  SLUG_QUERY_KEY,
} from './constants';
import type {
  CatalogHighlightDto,
  CatalogMediaDto,
  CatalogOrderManagerDto,
  CatalogProductDto,
  CatalogProductSaveDto,
} from './dto';
import type { CreateProductInput, ProductPatchInput } from './model/editor-patch';
import { sendForStore } from './model/store-bound-fetch';
import { readRequestToken, type StoreScope, storeQuery } from './queries';

/** Every field of a product the editor reads back after a load or a save. */
const PRODUCT_FIELDS = `
  id title slug description status price oldPrice sku barcode weight width height length
  featuredAsset { id } assets { id } brandId tagIds highlightIds collectionIds
  label cardCaption metaTitle metaDescription
  optionGroups { id name values { id name } }
  variants { id name sku price oldPrice barcode isHidden optionValues featuredAsset { id } }
  settings {
    nameInDelivery isFragile allowParcelOpening allowOutOfStockOrders soldOut
    quantityRules { enabled min step } orderManagerIds
  }`;

const PRODUCT_QUERY = `query CatalogProductEditor($id: ID!) { catalogProduct(id: $id) { ${PRODUCT_FIELDS} } }`;
const CREATE_MUTATION = `mutation CatalogCreateProduct($input: CreateCatalogProductInput!) {
  createCatalogProduct(input: $input) { product { ${PRODUCT_FIELDS} } warnings } }`;
const UPDATE_MUTATION = `mutation CatalogUpdateProduct($id: ID!, $input: UpdateCatalogProductInput!) {
  updateCatalogProduct(id: $id, input: $input) { product { ${PRODUCT_FIELDS} } warnings } }`;
const HIGHLIGHTS_QUERY = 'query CatalogHighlightOptions { catalogHighlights { id text } }';
const MEDIA_LIBRARY_QUERY = `query CatalogMediaLibrary($options: CatalogMediaListInput) {
  catalogMedia(options: $options) { items { id assetId previewUrl } } }`;
const UPLOAD_MUTATION = `mutation CatalogUploadMedia($file: Upload!) {
  uploadCatalogMedia(file: $file) { id assetId previewUrl } }`;
const SLUG_QUERY = `query CatalogSlugCheck($slug: String!, $productId: ID) {
  catalogSlugAvailability(slug: $slug, productId: $productId) { available slug } }`;
const ORDER_MANAGERS_QUERY = 'query CatalogOrderManagerOptions { teamOrderManagers { id name storeAccess storeIds } }';

/**
 * A write sent only while requests go to `scope`'s store ({@link sendForStore}). `api.mutate` with a string document
 * answers `unknown`; the answer's shape is the document's (auth precedent).
 */
async function mutate<T>(scope: StoreScope | null, document: string, variables: object): Promise<T> {
  return (await sendForStore(scope?.channelToken ?? null, readRequestToken, () =>
    api.mutate(document, variables),
  )) as T;
}

/** The product the editor opens, `null` when the active store has no such product. */
export function useCatalogProduct(scope: StoreScope | null, productId: string | null) {
  return useQuery({
    ...storeQuery(
      PRODUCT_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly catalogProduct: CatalogProductDto | null }>(PRODUCT_QUERY, { id: productId }))
          .catalogProduct,
      { productId },
    ),
    enabled: productId !== null,
  });
}

/** Creates a product in `scope`'s store; refused unsent when requests go to another store. */
export const createCatalogProduct = async (
  scope: StoreScope | null,
  input: CreateProductInput,
): Promise<CatalogProductSaveDto> =>
  (await mutate<{ readonly createCatalogProduct: CatalogProductSaveDto }>(scope, CREATE_MUTATION, { input }))
    .createCatalogProduct;

/** Updates a product of `scope`'s store; refused unsent when requests go to another store. */
export const updateCatalogProduct = async (
  scope: StoreScope | null,
  id: string,
  input: ProductPatchInput,
): Promise<CatalogProductSaveDto> =>
  (await mutate<{ readonly updateCatalogProduct: CatalogProductSaveDto }>(scope, UPDATE_MUTATION, { id, input }))
    .updateCatalogProduct;

export function useCatalogHighlights(scope: StoreScope | null) {
  return useQuery(
    storeQuery(
      HIGHLIGHTS_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly catalogHighlights: readonly CatalogHighlightDto[] }>(HIGHLIGHTS_QUERY))
          .catalogHighlights,
    ),
  );
}

/** The newest images of the business's library the caller may use (D2132), for the picker and the thumbnails. */
export function useMediaLibrary(scope: StoreScope | null) {
  return useQuery(
    storeQuery(
      MEDIA_LIBRARY_QUERY_KEY,
      scope,
      async () =>
        (
          await api.query<{ readonly catalogMedia: { readonly items: readonly CatalogMediaDto[] } }>(
            MEDIA_LIBRARY_QUERY,
            { options: { take: CATALOG_MAX_PAGE_SIZE } },
          )
        ).catalogMedia.items,
    ),
  );
}

/**
 * Uploads one image to the library of `scope`'s store through GraphQL multipart (D2113); the server sniffs and bounds
 * it. Refused unsent when requests go to another store.
 */
export const uploadCatalogMedia = async (scope: StoreScope | null, file: File): Promise<CatalogMediaDto> =>
  (await mutate<{ readonly uploadCatalogMedia: CatalogMediaDto }>(scope, UPLOAD_MUTATION, { file })).uploadCatalogMedia;

/** Whether `slug` is free in the active store for this product (D2103); waits while the slug is empty. */
export function useSlugAvailability(scope: StoreScope | null, slug: string, productId: string | null) {
  return useQuery({
    ...storeQuery(
      SLUG_QUERY_KEY,
      scope,
      async () =>
        (
          await api.query<{ readonly catalogSlugAvailability: { readonly available: boolean; readonly slug: string } }>(
            SLUG_QUERY,
            { slug, productId },
          )
        ).catalogSlugAvailability,
      { slug, productId },
    ),
    enabled: slug.trim() !== '',
  });
}

/** The members who may be named order managers; only asked when the caller holds the team view key (D2114). */
export function useOrderManagers(scope: StoreScope | null, allowed: boolean) {
  return useQuery({
    ...storeQuery(
      ORDER_MANAGERS_QUERY_KEY,
      scope,
      async () =>
        (await api.query<{ readonly teamOrderManagers: readonly CatalogOrderManagerDto[] }>(ORDER_MANAGERS_QUERY))
          .teamOrderManagers,
    ),
    enabled: allowed,
  });
}
