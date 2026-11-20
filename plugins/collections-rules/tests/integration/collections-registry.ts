/**
 * The registry of every collections handler: its operation or route, permission, a call aimed at a target's ids, and
 * what another store gets back. The coverage test and the isolation sweeps both read it.
 */
import type { OperationEntry, RouteEntry } from './registry-calls';

export {
  type ForeignOutcome,
  type OperationEntry,
  operationKey,
  type RouteEntry,
  routeKey,
  type TargetIdField,
  type TargetIds,
} from './registry-calls';

/** The fields every collection call reads back. */
export const COLLECTION_FIELDS =
  'id title slug description featuredAsset { id preview } mode visible position productCount';

/** A valid edit that names no other id, so only the target collection decides the answer. */
const EDIT = { title: 'Taken over', visible: false };

/** A slug no store of the sweep uses; the answer must be about the caller's store only. */
const SWEEP_SLUG = 'sweep-slug';

/** A rule every product matches (any price), so a preview lists the caller's whole store and nothing else. */
const MATCH_ALL_RULE = {
  version: 1,
  match: 'all',
  conditions: [{ field: 'price', operator: 'between', min: 0, max: null }],
};

/** Every Admin API operation the plugin's resolvers declare. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [
  {
    operation: 'storeCollections',
    access: 'catalog.collections.view',
    foreign: 'own-only',
    byId: false,
    document: `query { storeCollections { totalItems items { id } } }`,
    variables: () => ({}),
  },
  {
    operation: 'storeCollection',
    access: 'catalog.collections.view',
    foreign: 'null',
    byId: true,
    document: `query ($id: ID!) { storeCollection(id: $id) { ${COLLECTION_FIELDS} } }`,
    variables: (ids) => ({ id: ids.collectionId }),
  },
  {
    operation: 'createStoreCollection',
    access: 'catalog.collections.create',
    foreign: 'own-only',
    byId: false,
    document: `mutation ($input: CreateStoreCollectionInput!) { createStoreCollection(input: $input) { id } }`,
    variables: () => ({
      input: { title: 'Sweep made', slug: `sweep-${String(Date.now())}`, visible: true, position: 0, mode: 'manual' },
    }),
  },
  {
    operation: 'updateStoreCollection',
    access: 'catalog.collections.edit',
    foreign: 'not-found',
    byId: true,
    document: `mutation ($id: ID!, $input: UpdateStoreCollectionInput!) { updateStoreCollection(id: $id, input: $input) { id } }`,
    variables: (ids) => ({ id: ids.collectionId, input: EDIT }),
  },
  {
    operation: 'deleteStoreCollection',
    access: 'catalog.collections.delete',
    foreign: 'not-found',
    byId: true,
    document: `mutation ($id: ID!) { deleteStoreCollection(id: $id) }`,
    variables: (ids) => ({ id: ids.collectionId }),
  },
  {
    operation: 'storeCollectionProducts',
    access: 'catalog.collections.view',
    foreign: 'not-found',
    byId: true,
    document: `query ($id: ID!) { storeCollectionProducts(id: $id) { totalItems items { productId title } } }`,
    variables: (ids) => ({ id: ids.collectionId }),
  },
  {
    operation: 'storeCollectionSlugAvailability',
    access: 'catalog.collections.view',
    foreign: 'own-only',
    byId: false,
    document: `query ($slug: String!, $collectionId: ID) {
      storeCollectionSlugAvailability(slug: $slug, collectionId: $collectionId) { slug available }
    }`,
    variables: (ids) => ({ slug: SWEEP_SLUG, collectionId: ids.collectionId }),
  },
  {
    operation: 'storeProductCollections',
    access: 'catalog.collections.view',
    foreign: 'product-not-found',
    byId: true,
    idField: 'productId',
    document: `query ($productId: ID!) {
      storeProductCollections(productId: $productId) { manual { id title } automatic { id title } }
    }`,
    variables: (ids) => ({ productId: ids.productId }),
  },
  {
    operation: 'setStoreCollectionProducts',
    access: 'catalog.collections.edit',
    foreign: 'not-found',
    byId: true,
    document: `mutation ($id: ID!, $productIds: [ID!]!) {
      setStoreCollectionProducts(id: $id, productIds: $productIds) { id productCount }
    }`,
    variables: (ids) => ({ id: ids.collectionId, productIds: [] }),
  },
  {
    operation: 'setStoreProductCollections',
    access: 'catalog.collections.edit',
    foreign: 'product-not-found',
    byId: true,
    idField: 'productId',
    document: `mutation ($productId: ID!, $collectionIds: [ID!]!) {
      setStoreProductCollections(productId: $productId, collectionIds: $collectionIds) { manual { id } automatic { id } }
    }`,
    variables: (ids) => ({ productId: ids.productId, collectionIds: [] }),
  },
  {
    operation: 'storeCollectionRuleOptions',
    access: 'catalog.collections.view',
    foreign: 'own-only',
    byId: false,
    document: `query { storeCollectionRuleOptions { brands { id name } tags { id name } options { name values } } }`,
    variables: () => ({}),
  },
  {
    operation: 'storeCollectionProductSearch',
    access: 'catalog.collections.edit',
    foreign: 'own-only',
    byId: false,
    idField: 'productId',
    document: `query ($options: StoreCollectionProductSearchInput) {
      storeCollectionProductSearch(options: $options) { totalItems items { productId title } }
    }`,
    variables: () => ({ options: { take: 100 } }),
  },
  {
    operation: 'previewStoreCollectionMatches',
    access: 'catalog.collections.view',
    foreign: 'own-only',
    byId: false,
    idField: 'productId',
    document: `query ($input: StoreCollectionPreviewInput!) {
      previewStoreCollectionMatches(input: $input) { totalItems items { productId title } }
    }`,
    variables: () => ({ input: { rule: MATCH_ALL_RULE } }),
  },
];

/** Every REST route the plugin's controllers declare; literal routes before `:id` (D2315). */
export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  {
    method: 'GET',
    route: '/catalog/collections',
    access: 'catalog.collections.view',
    foreign: 'own-only',
    byId: false,
    url: () => '/catalog/collections',
  },
  {
    method: 'GET',
    route: '/catalog/collections/:id',
    access: 'catalog.collections.view',
    foreign: 'not-found',
    byId: true,
    url: (ids) => `/catalog/collections/${ids.collectionId}`,
  },
  {
    method: 'POST',
    route: '/catalog/collections',
    access: 'catalog.collections.create',
    foreign: 'own-only',
    byId: false,
    url: () => '/catalog/collections',
    body: () => ({
      title: 'Sweep made',
      slug: `rest-sweep-${String(Date.now())}`,
      visible: true,
      position: 0,
      mode: 'manual',
    }),
  },
  {
    method: 'PATCH',
    route: '/catalog/collections/:id',
    access: 'catalog.collections.edit',
    foreign: 'not-found',
    byId: true,
    url: (ids) => `/catalog/collections/${ids.collectionId}`,
    body: () => EDIT,
  },
  {
    method: 'DELETE',
    route: '/catalog/collections/:id',
    access: 'catalog.collections.delete',
    foreign: 'not-found',
    byId: true,
    url: (ids) => `/catalog/collections/${ids.collectionId}`,
  },
  {
    method: 'GET',
    route: '/catalog/collections/slug-availability',
    access: 'catalog.collections.view',
    foreign: 'own-only',
    byId: false,
    url: (ids) => `/catalog/collections/slug-availability?slug=${SWEEP_SLUG}&collectionId=${ids.collectionId}`,
  },
  {
    method: 'GET',
    route: '/catalog/collections/of-product/:productId',
    access: 'catalog.collections.view',
    foreign: 'product-not-found',
    byId: true,
    idField: 'productId',
    url: (ids) => `/catalog/collections/of-product/${ids.productId}`,
  },
  {
    method: 'PUT',
    route: '/catalog/collections/of-product/:productId',
    access: 'catalog.collections.edit',
    foreign: 'product-not-found',
    byId: true,
    idField: 'productId',
    url: (ids) => `/catalog/collections/of-product/${ids.productId}`,
    body: () => ({ collectionIds: [] }),
  },
  {
    method: 'GET',
    route: '/catalog/collections/:id/products',
    access: 'catalog.collections.view',
    foreign: 'not-found',
    byId: true,
    url: (ids) => `/catalog/collections/${ids.collectionId}/products`,
  },
  {
    method: 'PUT',
    route: '/catalog/collections/:id/products',
    access: 'catalog.collections.edit',
    foreign: 'not-found',
    byId: true,
    url: (ids) => `/catalog/collections/${ids.collectionId}/products`,
    body: () => ({ productIds: [] }),
  },
  {
    method: 'POST',
    route: '/catalog/collections/preview',
    access: 'catalog.collections.view',
    foreign: 'own-only',
    byId: false,
    idField: 'productId',
    url: () => '/catalog/collections/preview',
    body: () => ({ rule: MATCH_ALL_RULE }),
  },
  {
    method: 'GET',
    route: '/catalog/collections/rule-options',
    access: 'catalog.collections.view',
    foreign: 'own-only',
    byId: false,
    url: () => '/catalog/collections/rule-options',
  },
  {
    method: 'GET',
    route: '/catalog/collections/product-search',
    access: 'catalog.collections.edit',
    foreign: 'own-only',
    byId: false,
    idField: 'productId',
    url: () => '/catalog/collections/product-search?take=100',
  },
];
