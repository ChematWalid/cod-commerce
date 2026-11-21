import { catalogOf } from '../catalog-world';
import type { Caller, MatrixRequest } from '../http';
import { type IsolationAccess, type IsolationCase, ownChannel } from '../matrix';
import type { BusinessWorld } from '../world-types';

/**
 * Vendure's stock catalog endpoints in the P2 world (D2101): no catalog grant maps to a stock Vendure permission.
 * This world is the first where the member holds a catalog role (catalog=full) and real products and assets exist, so
 * a catalog grant that leaked into a stock permission would show here, not in the P1 suite's `stock.*` cells.
 */

interface StockCall {
  readonly name: string;
  readonly endpoint: string;
  readonly access: IsolationAccess;
  readonly what: string;
  readonly query: string;
  readonly variables: (attacker: BusinessWorld, victim: BusinessWorld) => Record<string, unknown>;
}

const STOCK_CALLS: readonly StockCall[] = [
  {
    name: 'products',
    endpoint: 'products',
    access: 'list',
    what: 'lists stock products',
    query: 'query { products { totalItems items { id } } }',
    variables: () => ({}),
  },
  {
    name: 'product-by-id',
    endpoint: 'product(id)',
    access: 'read by id',
    what: "reads B's product through the stock product(id)",
    query: 'query ($id: ID!) { product(id: $id) { id name } }',
    variables: (_a, b) => ({ id: catalogOf(b).product.id }),
  },
  {
    name: 'assets',
    endpoint: 'assets',
    access: 'list',
    what: 'lists stock assets',
    query: 'query { assets { totalItems items { id source } } }',
    variables: () => ({}),
  },
  {
    name: 'asset-by-id',
    endpoint: 'asset(id)',
    access: 'read by id',
    what: "reads B's media asset through the stock asset(id)",
    query: 'query ($id: ID!) { asset(id: $id) { id source } }',
    variables: (_a, b) => ({ id: catalogOf(b).media.assetId }),
  },
  {
    name: 'update-product',
    endpoint: 'updateProduct',
    access: 'write',
    what: "edits A's own product through the stock updateProduct",
    query: 'mutation ($input: UpdateProductInput!) { updateProduct(input: $input) { id } }',
    variables: (a) => ({ input: { id: catalogOf(a).product.id, enabled: true } }),
  },
];

const CALLERS: readonly { readonly role: string; readonly of: (business: BusinessWorld) => Caller }[] = [
  { role: 'owner', of: (business) => business.owner },
  { role: 'member', of: (business) => business.member },
];

const requestOf = (call: StockCall, caller: Caller, a: BusinessWorld, b: BusinessWorld): MatrixRequest => ({
  method: 'POST',
  path: '/admin-api',
  caller,
  channel: ownChannel(a),
  body: { query: call.query, variables: call.variables(a, b) },
});

/** A's owner and A's catalog-role member call each stock catalog endpoint on A's store: FORBIDDEN. */
export const CATALOG_STOCK_CASES: readonly IsolationCase[] = CALLERS.flatMap(({ role, of }) =>
  STOCK_CALLS.map((call): IsolationCase => ({
    id: `catalog.stock-${call.name}.${role}`,
    entity: 'stock Vendure data',
    endpoint: call.endpoint,
    access: call.access,
    title: `A's ${role} (catalog=full) ${call.what} on A's store: FORBIDDEN`,
    request: (a, b) => requestOf(call, of(a), a, b),
    expect: { kind: 'forbidden' },
    reverse: call.access === 'read by id',
  })),
);
