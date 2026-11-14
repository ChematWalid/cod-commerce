import type { CatalogOperation, CatalogRoute } from './catalog-operation-types';

const SOLD_OUT_FIELDS = 'productId title allowOutOfStockOrders';

/** The sold-out products and Stop / Resume orders (D2108): a list of ids, so no by-id cell; B's id is left out. */
export const SOLD_OUT_OPERATIONS: readonly CatalogOperation[] = [
  {
    name: 'catalogSoldOutProducts',
    entity: 'product',
    document: `query { catalogSoldOutProducts { ${SOLD_OUT_FIELDS} } }`,
    variables: () => ({}),
  },
  ...(['stopCatalogSoldOutOrders', 'resumeCatalogSoldOutOrders'] as const).map((name): CatalogOperation => ({
    name,
    entity: 'product',
    document: `mutation ($input: CatalogSoldOutOrdersInput!) { ${name}(input: $input) { ${SOLD_OUT_FIELDS} } }`,
    variables: (t) => ({ input: { productIds: [t.productId] } }),
  })),
];

/** The sold-out REST routes; a write's empty body acts on the caller's own sold-out products. */
export const SOLD_OUT_ROUTES: readonly CatalogRoute[] = [
  {
    method: 'GET',
    route: '/catalog/sold-out-products',
    entity: 'product',
    path: () => '/catalog/sold-out-products',
  },
  ...(['stop-orders', 'resume-orders'] as const).map((action): CatalogRoute => ({
    method: 'POST',
    route: `/catalog/sold-out-products/${action}`,
    entity: 'product',
    path: () => `/catalog/sold-out-products/${action}`,
    body: () => ({}),
  })),
];
