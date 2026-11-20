import { api } from '@vendure/dashboard';
import type {
  CollectionMediaDto,
  CreateStoreCollectionInput,
  StoreCollectionDto,
  StoreProductCollectionsDto,
  UpdateStoreCollectionInput,
} from './dto';
import { type StoreScope, sendToStore } from './model/store-query';
import { COLLECTION_FIELDS } from './queries';

const CREATE_MUTATION = `mutation StoreCollectionCreate($input: CreateStoreCollectionInput!) {
  createStoreCollection(input: $input) { ${COLLECTION_FIELDS} } }`;
const UPDATE_MUTATION = `mutation StoreCollectionUpdate($id: ID!, $input: UpdateStoreCollectionInput!) {
  updateStoreCollection(id: $id, input: $input) { ${COLLECTION_FIELDS} } }`;
const DELETE_MUTATION = 'mutation StoreCollectionDelete($id: ID!) { deleteStoreCollection(id: $id) }';
const SET_PRODUCTS_MUTATION = `mutation StoreCollectionSetProducts($id: ID!, $productIds: [ID!]!) {
  setStoreCollectionProducts(id: $id, productIds: $productIds) { ${COLLECTION_FIELDS} } }`;
const SET_PRODUCT_COLLECTIONS_MUTATION = `mutation StoreProductCollectionsSet($productId: ID!, $collectionIds: [ID!]!) {
  setStoreProductCollections(productId: $productId, collectionIds: $collectionIds) { manual { id title } automatic { id title } } }`;
const UPLOAD_MUTATION = `mutation CollectionsUploadMedia($file: Upload!) {
  uploadCatalogMedia(file: $file) { id assetId previewUrl } }`;

/**
 * A write of `scope`'s store, sent only while requests go to it (D2160). `api.mutate` with a string document answers
 * `unknown`; the answer's shape is the document's (catalog precedent).
 */
async function mutate<T>(scope: StoreScope | null, document: string, variables: object): Promise<T> {
  return (await sendToStore(scope, () => api.mutate(document, variables))) as T;
}

export const createStoreCollection = async (
  scope: StoreScope | null,
  input: CreateStoreCollectionInput,
): Promise<StoreCollectionDto> =>
  (await mutate<{ readonly createStoreCollection: StoreCollectionDto }>(scope, CREATE_MUTATION, { input }))
    .createStoreCollection;

export const updateStoreCollection = async (
  scope: StoreScope | null,
  id: string,
  input: UpdateStoreCollectionInput,
): Promise<StoreCollectionDto> =>
  (await mutate<{ readonly updateStoreCollection: StoreCollectionDto }>(scope, UPDATE_MUTATION, { id, input }))
    .updateStoreCollection;

export const deleteStoreCollection = async (scope: StoreScope | null, id: string): Promise<boolean> =>
  (await mutate<{ readonly deleteStoreCollection: boolean }>(scope, DELETE_MUTATION, { id })).deleteStoreCollection;

/** Replaces a manual collection's products with `productIds`, in that order (D2318). */
export const setStoreCollectionProducts = async (
  scope: StoreScope | null,
  id: string,
  productIds: readonly string[],
): Promise<StoreCollectionDto> =>
  (
    await mutate<{ readonly setStoreCollectionProducts: StoreCollectionDto }>(scope, SET_PRODUCTS_MUTATION, {
      id,
      productIds,
    })
  ).setStoreCollectionProducts;

/** Uploads one image to catalog's library through GraphQL multipart; needs catalog's create key (D2320). */
export const uploadCollectionImage = async (scope: StoreScope | null, file: File): Promise<CollectionMediaDto> =>
  (await mutate<{ readonly uploadCatalogMedia: CollectionMediaDto }>(scope, UPLOAD_MUTATION, { file }))
    .uploadCatalogMedia;

/** Replaces the manual collections of one product with `collectionIds` (D2324); automatic ones stay the rule's. */
export const setStoreProductCollections = async (
  scope: StoreScope | null,
  productId: string,
  collectionIds: readonly string[],
): Promise<StoreProductCollectionsDto> =>
  (
    await mutate<{ readonly setStoreProductCollections: StoreProductCollectionsDto }>(
      scope,
      SET_PRODUCT_COLLECTIONS_MUTATION,
      { productId, collectionIds },
    )
  ).setStoreProductCollections;
