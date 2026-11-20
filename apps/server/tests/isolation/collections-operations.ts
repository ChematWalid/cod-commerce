import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import type { ById, CatalogOperation, CatalogRoute, CatalogTarget } from './catalog-operations';

/**
 * Every collections endpoint (P2.S3) as the P2 matrix calls it, in the catalog list's shape: each Admin API operation
 * and each REST route, and, for a by-id one, which row it names and what "no such row" answers. The generated sweep
 * (`cases/collections-sweep.ts`) builds its cells from these lists, so a new endpoint is one entry here. The target's
 * `collectionId` is the business's manual collection and `productId` its catalog product.
 */

const C = COLLECTIONS_ERROR_CODES;
const COLLECTION_BY_ID: ById = { field: 'collectionId', notFound: C.NOT_FOUND };
const PRODUCT_BY_ID: ById = { field: 'productId', notFound: C.PRODUCT_NOT_FOUND };
/** A slug no store of the world uses: the answer is about the caller's store only. */
const SWEEP_SLUG = 'isolation-sweep-slug';
/** A valid edit naming no other id, so only the target collection decides the answer. */
const EDIT = { title: 'Taken over', visible: false };
const CREATE = { title: 'Synthetic collection', slug: SWEEP_SLUG, visible: true, position: 0, mode: 'manual' };
/** A rule every product matches (any price), so a preview lists the caller's whole store and nothing else. */
const MATCH_ALL_RULE = {
  version: 1,
  match: 'all',
  conditions: [{ field: 'price', operator: 'between', min: 0, max: null }],
};
const COLLECTION_FIELDS = 'id title slug mode visible position productCount';

const READ_OPERATIONS: readonly CatalogOperation[] = [
  {
    name: 'storeCollections',
    entity: 'collection',
    document: 'query { storeCollections { totalItems items { id title } } }',
    variables: () => ({}),
  },
  {
    name: 'storeCollection',
    entity: 'collection',
    document: `query ($id: ID!) { storeCollection(id: $id) { ${COLLECTION_FIELDS} } }`,
    variables: (t) => ({ id: t.collectionId }),
    byId: { field: 'collectionId', notFound: null },
  },
  {
    name: 'storeCollectionProducts',
    entity: 'collection',
    document: 'query ($id: ID!) { storeCollectionProducts(id: $id) { totalItems items { productId title } } }',
    variables: (t) => ({ id: t.collectionId }),
    byId: COLLECTION_BY_ID,
  },
  {
    name: 'storeCollectionSlugAvailability',
    entity: 'collection',
    document: `query ($slug: String!, $collectionId: ID) {
  storeCollectionSlugAvailability(slug: $slug, collectionId: $collectionId) { slug available }
}`,
    variables: (t) => ({ slug: SWEEP_SLUG, collectionId: t.collectionId }),
  },
  {
    name: 'storeProductCollections',
    entity: 'collection',
    document: `query ($productId: ID!) {
  storeProductCollections(productId: $productId) { manual { id title } automatic { id title } }
}`,
    variables: (t) => ({ productId: t.productId }),
    byId: PRODUCT_BY_ID,
  },
  {
    name: 'storeCollectionRuleOptions',
    entity: 'collection',
    document: 'query { storeCollectionRuleOptions { brands { id name } tags { id name } options { name values } } }',
    variables: () => ({}),
  },
  {
    name: 'storeCollectionProductSearch',
    entity: 'collection',
    document: `query ($options: StoreCollectionProductSearchInput) {
  storeCollectionProductSearch(options: $options) { totalItems items { productId title } }
}`,
    variables: () => ({ options: { take: 100 } }),
  },
  {
    name: 'previewStoreCollectionMatches',
    entity: 'collection',
    document: `query ($input: StoreCollectionPreviewInput!) {
  previewStoreCollectionMatches(input: $input) { totalItems items { productId title } }
}`,
    variables: () => ({ input: { rule: MATCH_ALL_RULE } }),
  },
];

const WRITE_OPERATIONS: readonly CatalogOperation[] = [
  {
    name: 'createStoreCollection',
    entity: 'collection',
    document: 'mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id } }',
    variables: () => ({ input: CREATE }),
  },
  {
    name: 'updateStoreCollection',
    entity: 'collection',
    document: `mutation ($id: ID!, $input: UpdateStoreCollectionInput!) {
  updateStoreCollection(id: $id, input: $input) { id title }
}`,
    variables: (t) => ({ id: t.collectionId, input: EDIT }),
    byId: COLLECTION_BY_ID,
  },
  {
    name: 'deleteStoreCollection',
    entity: 'collection',
    document: 'mutation ($id: ID!) { deleteStoreCollection(id: $id) }',
    variables: (t) => ({ id: t.collectionId }),
    byId: COLLECTION_BY_ID,
  },
  {
    name: 'setStoreCollectionProducts',
    entity: 'collection',
    document: `mutation ($id: ID!, $productIds: [ID!]!) {
  setStoreCollectionProducts(id: $id, productIds: $productIds) { id productCount }
}`,
    variables: (t) => ({ id: t.collectionId, productIds: [] }),
    byId: COLLECTION_BY_ID,
  },
  {
    name: 'setStoreProductCollections',
    entity: 'collection',
    document: `mutation ($productId: ID!, $collectionIds: [ID!]!) {
  setStoreProductCollections(productId: $productId, collectionIds: $collectionIds) { manual { id } automatic { id } }
}`,
    variables: (t) => ({ productId: t.productId, collectionIds: [] }),
    byId: PRODUCT_BY_ID,
  },
];

/** Every Admin API operation of the collections plugin. */
export const COLLECTION_OPERATIONS: readonly CatalogOperation[] = [...READ_OPERATIONS, ...WRITE_OPERATIONS];

const BASE = '/catalog/collections';
const COLLECTION_ROUTE_BY_ID = { field: 'collectionId', notFound: C.NOT_FOUND } as const;
const PRODUCT_ROUTE_BY_ID = { field: 'productId', notFound: C.PRODUCT_NOT_FOUND } as const;
const one =
  (suffix = '') =>
  (t: CatalogTarget): string =>
    `${BASE}/${t.collectionId}${suffix}`;
const ofProduct = (t: CatalogTarget): string => `${BASE}/of-product/${t.productId}`;

/** Every REST route of the collections plugin; literal routes before `:id` (D2315). */
export const COLLECTION_ROUTES: readonly CatalogRoute[] = [
  { method: 'GET', route: BASE, entity: 'collection', path: () => BASE },
  { method: 'POST', route: BASE, entity: 'collection', path: () => BASE, body: () => CREATE },
  {
    method: 'GET',
    route: `${BASE}/slug-availability`,
    entity: 'collection',
    path: (t) => `${BASE}/slug-availability?slug=${SWEEP_SLUG}&collectionId=${t.collectionId}`,
  },
  { method: 'GET', route: `${BASE}/rule-options`, entity: 'collection', path: () => `${BASE}/rule-options` },
  {
    method: 'GET',
    route: `${BASE}/product-search`,
    entity: 'collection',
    path: () => `${BASE}/product-search?take=100`,
  },
  {
    method: 'POST',
    route: `${BASE}/preview`,
    entity: 'collection',
    path: () => `${BASE}/preview`,
    body: () => ({ rule: MATCH_ALL_RULE }),
  },
  {
    method: 'GET',
    route: `${BASE}/of-product/:productId`,
    entity: 'collection',
    path: ofProduct,
    byId: PRODUCT_ROUTE_BY_ID,
  },
  {
    method: 'PUT',
    route: `${BASE}/of-product/:productId`,
    entity: 'collection',
    path: ofProduct,
    body: () => ({ collectionIds: [] }),
    byId: PRODUCT_ROUTE_BY_ID,
  },
  { method: 'GET', route: `${BASE}/:id`, entity: 'collection', path: one(), byId: COLLECTION_ROUTE_BY_ID },
  {
    method: 'PATCH',
    route: `${BASE}/:id`,
    entity: 'collection',
    path: one(),
    body: () => EDIT,
    byId: COLLECTION_ROUTE_BY_ID,
  },
  { method: 'DELETE', route: `${BASE}/:id`, entity: 'collection', path: one(), byId: COLLECTION_ROUTE_BY_ID },
  {
    method: 'GET',
    route: `${BASE}/:id/products`,
    entity: 'collection',
    path: one('/products'),
    byId: COLLECTION_ROUTE_BY_ID,
  },
  {
    method: 'PUT',
    route: `${BASE}/:id/products`,
    entity: 'collection',
    path: one('/products'),
    body: () => ({ productIds: [] }),
    byId: COLLECTION_ROUTE_BY_ID,
  },
];
