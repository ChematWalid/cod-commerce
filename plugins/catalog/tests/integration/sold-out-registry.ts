/** The registry entries of the sold-out products and their order gating (Task 17, D2108). */
import type { OperationEntry, RouteEntry } from './registry-calls';

const VIEW = 'catalog.products.view';
const EDIT = 'catalog.products.edit';
const SOLD_OUT_FIELDS = 'productId title allowOutOfStockOrders';

/** Every Admin API operation of the sold-out products; a foreign product id is left out of the answer. */
export const SOLD_OUT_OPERATIONS: readonly OperationEntry[] = [
  {
    operation: 'catalogSoldOutProducts',
    access: VIEW,
    foreign: 'own-only',
    byId: false,
    document: `query { catalogSoldOutProducts { ${SOLD_OUT_FIELDS} } }`,
    variables: () => ({}),
  },
  ...(['stopCatalogSoldOutOrders', 'resumeCatalogSoldOutOrders'] as const).map((operation): OperationEntry => ({
    operation,
    access: EDIT,
    foreign: 'own-only',
    byId: false,
    document: `mutation ($input: CatalogSoldOutOrdersInput!) { ${operation}(input: $input) { ${SOLD_OUT_FIELDS} } }`,
    variables: (ids) => ({ input: { productIds: [ids.productId] } }),
  })),
];

/** Every REST route of the sold-out products. */
export const SOLD_OUT_ROUTES: readonly RouteEntry[] = [
  {
    method: 'GET',
    route: '/catalog/sold-out-products',
    access: VIEW,
    foreign: 'own-only',
    url: () => '/catalog/sold-out-products',
  },
  ...(['stop-orders', 'resume-orders'] as const).map((action): RouteEntry => ({
    method: 'POST',
    route: `/catalog/sold-out-products/${action}`,
    access: EDIT,
    foreign: 'own-only',
    url: () => `/catalog/sold-out-products/${action}`,
    body: (ids) => ({ productIds: [ids.productId] }),
  })),
];
