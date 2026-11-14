/**
 * The registry of every catalog handler: its operation or route, permission, a call aimed at a target's ids, and what
 * another business gets back. The coverage test and the isolation sweep both read it.
 */
import type { OperationEntry, TargetIds } from './registry-calls';
import { MEDIA_OPERATIONS } from './media-registry';
import { TAXONOMY_OPERATIONS } from './taxonomy-registry';

export { ROUTE_REGISTRY } from './route-registry';
export {
  type ForeignOutcome,
  type OperationEntry,
  operationKey,
  type RouteEntry,
  routeKey,
  type TargetIdField,
  type TargetIds,
} from './registry-calls';

/** A product body naming the target's collection. */
export const productNaming = (ids: TargetIds): Readonly<Record<string, unknown>> => ({
  title: 'Synthetic product',
  status: 'active',
  price: 100,
  collectionIds: [ids.collectionId],
});

/** Every Admin API operation the plugin's resolvers declare. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [
  {
    operation: 'catalogProducts',
    access: 'catalog.products.view',
    foreign: 'own-only',
    byId: false,
    document:
      'query ($options: CatalogProductListInput) { catalogProducts(options: $options) { totalItems items { id } } }',
    variables: (ids) => ({ options: { collectionId: ids.collectionId } }),
  },
  {
    operation: 'catalogProduct',
    access: 'catalog.products.view',
    foreign: 'null',
    byId: true,
    document: 'query ($id: ID!) { catalogProduct(id: $id) { id } }',
    variables: (ids) => ({ id: ids.productId }),
  },
  {
    operation: 'catalogSlugAvailability',
    access: 'catalog.products.view',
    foreign: 'own-only',
    byId: false,
    document: 'query ($slug: String!) { catalogSlugAvailability(slug: $slug) { available slug } }',
    variables: () => ({ slug: 'synthetic-target-slug' }),
  },
  {
    operation: 'createCatalogProduct',
    access: 'catalog.products.create',
    foreign: 'not-found',
    byId: false,
    document:
      'mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id } } }',
    variables: (ids) => ({ input: productNaming(ids) }),
  },
  {
    operation: 'updateCatalogProduct',
    access: 'catalog.products.edit',
    foreign: 'not-found',
    byId: true,
    document:
      'mutation ($id: ID!, $input: UpdateCatalogProductInput!) { updateCatalogProduct(id: $id, input: $input) { product { id } } }',
    variables: (ids) => ({ id: ids.productId, input: { label: 'Synthetic' } }),
  },
  {
    operation: 'setCatalogProductStatus',
    access: 'catalog.products.edit',
    foreign: 'not-found',
    byId: true,
    document: 'mutation ($id: ID!) { setCatalogProductStatus(id: $id, status: draft) { id } }',
    variables: (ids) => ({ id: ids.productId }),
  },
  {
    operation: 'deleteCatalogProduct',
    access: 'catalog.products.delete',
    foreign: 'not-found',
    byId: true,
    document: 'mutation ($id: ID!) { deleteCatalogProduct(id: $id) }',
    variables: (ids) => ({ id: ids.productId }),
  },
  ...TAXONOMY_OPERATIONS,
  ...MEDIA_OPERATIONS,
];
