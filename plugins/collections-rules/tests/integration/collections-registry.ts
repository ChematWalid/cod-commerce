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
];
