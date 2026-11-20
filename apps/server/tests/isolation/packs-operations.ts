import { CATALOG_PACKS_ERROR_CODES } from '@cod/shared';
import { catalogImportOf } from './catalog-import-world';
import { restIdOf } from './catalog-world';
import type { SweptEndpoints, SweptOperation, SweptRoute } from './endpoint-sweep';
import type { BusinessWorld } from './world-types';

/**
 * Every pack endpoint (plugins/catalog-packs, P2.S2) as the P2 matrix calls it, aimed at a business's saved pack and
 * its two components. The pack cases build their cells from these lists, so a new endpoint is one entry here.
 */

const P = CATALOG_PACKS_ERROR_CODES;
const NOT_FOUND = 404;

/** The pack rows of a business a call names. */
export interface PackTarget {
  readonly productId: string;
  readonly componentId: string;
  readonly otherComponentId: string;
}

/** `business`'s pack rows as GraphQL names them. */
export function packTargetOf(business: BusinessWorld): PackTarget {
  const { pack } = catalogImportOf(business);
  return { productId: pack.productId, componentId: pack.componentIds[0], otherComponentId: pack.componentIds[1] };
}

/** `business`'s pack rows as the REST routes name them. */
export function restPackTargetOf(business: BusinessWorld): PackTarget {
  const target = packTargetOf(business);
  return {
    productId: restIdOf(target.productId),
    componentId: restIdOf(target.componentId),
    otherComponentId: restIdOf(target.otherComponentId),
  };
}

/** A pack input naming `target`'s two components. */
export const packBody = (target: PackTarget): Record<string, unknown> => ({
  packPricingMode: 'components_sum',
  packVariantMode: 'per_component',
  packWeightMode: 'components_sum',
  components: [
    { productId: target.componentId, quantity: 1 },
    { productId: target.otherComponentId, quantity: 2 },
  ],
});

export const SAVE_PACK_DOCUMENT =
  'mutation ($id: ID!, $input: CatalogPackInput!) { saveCatalogPack(productId: $id, input: $input) { productId price } }';

export const PACKS_OPERATIONS: readonly SweptOperation<PackTarget>[] = [
  {
    name: 'catalogPack',
    entity: 'pack',
    document: 'query ($id: ID!) { catalogPack(productId: $id) { productId price } }',
    variables: (t) => ({ id: t.productId }),
    foreign: { kind: 'null', field: 'catalogPack' },
  },
  {
    name: 'saveCatalogPack',
    entity: 'pack',
    document: SAVE_PACK_DOCUMENT,
    variables: (t) => ({ id: t.productId, input: packBody(t) }),
    foreign: { kind: 'code', code: P.NOT_FOUND },
  },
  {
    name: 'previewCatalogPack',
    entity: 'pack',
    document: 'mutation ($input: CatalogPackInput!) { previewCatalogPack(input: $input) { price weightGrams } }',
    variables: (t) => ({ input: packBody(t) }),
    foreign: { kind: 'code', code: P.COMPONENT_NOT_FOUND },
  },
];

export const PACKS_ROUTES: readonly SweptRoute<PackTarget>[] = [
  {
    method: 'POST',
    route: '/catalog/packs/preview',
    entity: 'pack',
    path: () => '/catalog/packs/preview',
    body: packBody,
    foreign: { kind: 'status', status: NOT_FOUND, code: P.COMPONENT_NOT_FOUND },
  },
  {
    method: 'GET',
    route: '/catalog/packs/:productId',
    entity: 'pack',
    path: (t) => `/catalog/packs/${t.productId}`,
    foreign: { kind: 'status', status: NOT_FOUND, code: P.NOT_FOUND },
  },
  {
    method: 'PUT',
    route: '/catalog/packs/:productId',
    entity: 'pack',
    path: (t) => `/catalog/packs/${t.productId}`,
    body: packBody,
    foreign: { kind: 'status', status: NOT_FOUND, code: P.NOT_FOUND },
  },
];

/** The pack endpoints and their targets, for `sweepCases`. */
export const PACKS_ENDPOINTS: SweptEndpoints<PackTarget> = {
  prefix: 'packs',
  operations: PACKS_OPERATIONS,
  routes: PACKS_ROUTES,
  targetOf: packTargetOf,
  restTargetOf: restPackTargetOf,
};
