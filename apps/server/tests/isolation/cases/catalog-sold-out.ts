import { catalogOf } from '../catalog-world';
import { type IsolationCase, ownerGraphql, ownerRest } from '../matrix';
import { restTargetOf } from '../catalog-operations';

/**
 * The sold-out cells of the P2 matrix (P2.S1, D2108): A's owner lists A's own sold-out products only, and Stop /
 * Resume orders naming B's sold-out product change nothing of B's (the snapshot after the matrix holds B's gating).
 * B's token, the store-restricted member and the unknown store come from the generated sweep.
 */

const FIELDS = 'productId title allowOutOfStockOrders';
const LIST = `query { catalogSoldOutProducts { ${FIELDS} } }`;
const ordersMutation = (name: string): string =>
  `mutation ($input: CatalogSoldOutOrdersInput!) { ${name}(input: $input) { ${FIELDS} } }`;

/** Stop or Resume orders as A's owner naming B's sold-out product: an empty answer. */
function namingVictim(name: string, route: string): IsolationCase[] {
  return [
    {
      id: `catalog.${name}.foreign-product`,
      entity: 'product',
      endpoint: name,
      access: 'write',
      title: `A's owner calls ${name} naming B's sold-out product: nothing changes`,
      request: (a, b) => ownerGraphql(a, ordersMutation(name), { input: { productIds: [catalogOf(b).product.id] } }),
      expect: { kind: 'own', mustInclude: () => [] },
      reverse: true,
    },
    {
      id: `catalog.post-${route}.foreign-product`,
      entity: 'product',
      endpoint: `POST ${route}`,
      access: 'write',
      title: `A's owner calls POST ${route} naming B's sold-out product: nothing changes`,
      request: (a, b) => ownerRest(a, 'POST', route, { productIds: [restTargetOf(b).productId] }),
      expect: { kind: 'own', mustInclude: () => [] },
      reverse: true,
    },
  ];
}

export const CATALOG_SOLD_OUT_CASES: readonly IsolationCase[] = [
  {
    id: 'catalog.catalogSoldOutProducts.list',
    entity: 'product',
    endpoint: 'catalogSoldOutProducts',
    access: 'list',
    title: "A's owner lists A's sold-out products: A's own only",
    request: (a) => ownerGraphql(a, LIST),
    expect: { kind: 'own', mustInclude: (a) => [catalogOf(a).product.id] },
    reverse: true,
  },
  {
    id: 'catalog.get-/catalog/sold-out-products.list',
    entity: 'product',
    endpoint: 'GET /catalog/sold-out-products',
    access: 'list',
    title: "A's owner lists A's sold-out products over REST: A's own only",
    request: (a) => ownerRest(a, 'GET', '/catalog/sold-out-products'),
    expect: { kind: 'own', mustInclude: (a) => [catalogOf(a).product.restId] },
    reverse: true,
  },
  ...namingVictim('stopCatalogSoldOutOrders', '/catalog/sold-out-products/stop-orders'),
  ...namingVictim('resumeCatalogSoldOutOrders', '/catalog/sold-out-products/resume-orders'),
];
