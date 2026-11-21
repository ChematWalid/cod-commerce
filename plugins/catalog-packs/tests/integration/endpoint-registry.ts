/**
 * The registry of every pack handler: its operation or route, permission, a call aimed at a target's ids, and what
 * another business gets back. The coverage test, the isolation sweep and the permission suite read it.
 */
import { CATALOG_PACKS_ERROR_CODES, type PermissionKey } from '@cod/shared';

const P = CATALOG_PACKS_ERROR_CODES;

/** The ids of one business a call names; the isolation sweep fills them with B's and calls as A. */
export interface TargetIds {
  /** A pack product holding a saved pack. */
  readonly productId: string;
  /** Its two components. */
  readonly componentId: string;
  readonly otherComponentId: string;
}

/** `null` (a read of none) or `not-found` (the entry's not-found code, 404 over REST). */
export type ForeignOutcome = 'null' | 'not-found';

/** One Admin API operation of the plugin, with a call aimed at a target's ids. */
export interface OperationEntry {
  readonly operation: string;
  readonly access: PermissionKey;
  readonly foreign: ForeignOutcome;
  /** Whether the call names the pack product id, which a malformed id can replace. */
  readonly byId: boolean;
  readonly notFound: string;
  readonly document: string;
  readonly variables: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call aimed at a target's ids. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PUT';
  readonly route: string;
  readonly access: PermissionKey;
  readonly notFound: string;
  readonly url: (ids: TargetIds) => string;
  readonly body?: (ids: TargetIds) => Readonly<Record<string, unknown>>;
}

/** A pack input naming the target's components. */
export const packBody = (ids: TargetIds): Readonly<Record<string, unknown>> => ({
  packPricingMode: 'components_sum',
  packVariantMode: 'per_component',
  packWeightMode: 'components_sum',
  components: [
    { productId: ids.componentId, quantity: 1 },
    { productId: ids.otherComponentId, quantity: 2 },
  ],
});

/** Every Admin API operation the plugin's resolvers declare. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [
  {
    operation: 'catalogPack',
    access: 'catalog.products.view',
    foreign: 'null',
    byId: true,
    notFound: P.NOT_FOUND,
    document: 'query ($id: ID!) { catalogPack(productId: $id) { productId price } }',
    variables: (ids) => ({ id: ids.productId }),
  },
  {
    operation: 'saveCatalogPack',
    access: 'catalog.products.edit',
    foreign: 'not-found',
    byId: true,
    notFound: P.NOT_FOUND,
    document:
      'mutation ($id: ID!, $input: CatalogPackInput!) { saveCatalogPack(productId: $id, input: $input) { productId price } }',
    variables: (ids) => ({ id: ids.productId, input: packBody(ids) }),
  },
  {
    operation: 'previewCatalogPack',
    access: 'catalog.products.edit',
    foreign: 'not-found',
    byId: false,
    notFound: P.COMPONENT_NOT_FOUND,
    document: 'mutation ($input: CatalogPackInput!) { previewCatalogPack(input: $input) { price weightGrams } }',
    variables: (ids) => ({ input: packBody(ids) }),
  },
];

/** Every REST route the plugin's controllers declare. */
export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  {
    method: 'POST',
    route: '/catalog/packs/preview',
    access: 'catalog.products.edit',
    notFound: P.COMPONENT_NOT_FOUND,
    url: () => '/catalog/packs/preview',
    body: packBody,
  },
  {
    method: 'GET',
    route: '/catalog/packs/:productId',
    access: 'catalog.products.view',
    notFound: P.NOT_FOUND,
    url: (ids) => `/catalog/packs/${ids.productId}`,
  },
  {
    method: 'PUT',
    route: '/catalog/packs/:productId',
    access: 'catalog.products.edit',
    notFound: P.NOT_FOUND,
    url: (ids) => `/catalog/packs/${ids.productId}`,
    body: packBody,
  },
];

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
