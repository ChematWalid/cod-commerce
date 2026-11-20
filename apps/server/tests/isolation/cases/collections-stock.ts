import { catalogOf } from '../catalog-world';
import { collectionsOf, seededCollectionsFilter } from '../collections-world';
import type { Caller, MatrixRequest } from '../http';
import { type IsolationAccess, type IsolationCase, ownChannel } from '../matrix';
import type { BusinessWorld } from '../world-types';

/**
 * Vendure's stock collection endpoints in the P2 world (D2101, D2314): neither the owner nor the member with the whole
 * catalog area (collections included) reaches them, so our collections are only ever read and written through the
 * `storeCollection*` surface. The writes name A's own collection, so a stock write that slipped through would change
 * A's snapshot. Then the default channel census (D2333): the superadmin's stock list of the default channel holds no
 * seeded collection (the Shop API is internal-only, D112: its census is a signed call in `p2-isolation.e2e.test.ts`).
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
    name: 'collections',
    endpoint: 'collections',
    access: 'list',
    what: 'lists stock collections',
    query: 'query { collections { totalItems items { id name slug } } }',
    variables: () => ({}),
  },
  {
    name: 'collection-by-id',
    endpoint: 'collection(id)',
    access: 'read by id',
    what: "reads B's collection through the stock collection(id)",
    query: 'query ($id: ID!) { collection(id: $id) { id name slug } }',
    variables: (_a, b) => ({ id: catalogOf(b).collection.id }),
  },
  {
    name: 'create-collection',
    endpoint: 'createCollection',
    access: 'write',
    what: 'creates a collection through the stock createCollection',
    query: 'mutation ($input: CreateCollectionInput!) { createCollection(input: $input) { id } }',
    variables: () => ({
      input: { translations: [{ languageCode: 'ar', name: 'Stock', slug: 'stock', description: '' }], filters: [] },
    }),
  },
  {
    name: 'update-collection',
    endpoint: 'updateCollection',
    access: 'write',
    what: "edits A's own collection through the stock updateCollection",
    query: 'mutation ($input: UpdateCollectionInput!) { updateCollection(input: $input) { id } }',
    variables: (a) => ({ input: { id: catalogOf(a).collection.id, isPrivate: true } }),
  },
  {
    name: 'delete-collection',
    endpoint: 'deleteCollection',
    access: 'write',
    what: "deletes A's own collection through the stock deleteCollection",
    query: 'mutation ($id: ID!) { deleteCollection(id: $id) { result } }',
    variables: (a) => ({ id: catalogOf(a).collection.id }),
  },
  {
    name: 'preview-collection-variants',
    endpoint: 'previewCollectionVariants',
    access: 'list',
    what: 'previews stock collection filters',
    query: `query ($input: PreviewCollectionVariantsInput!) {
  previewCollectionVariants(input: $input) { totalItems items { id name } }
}`,
    variables: () => ({ input: { inheritFilters: false, filters: [] } }),
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

/** A's owner and A's catalog-role member call each stock collection endpoint on A's store: FORBIDDEN. */
const STOCK_CASES: readonly IsolationCase[] = CALLERS.flatMap(({ role, of }) =>
  STOCK_CALLS.map((call): IsolationCase => ({
    id: `collections.stock-${call.name}.${role}`,
    entity: 'stock Vendure data',
    endpoint: call.endpoint,
    access: call.access,
    title: `A's ${role} (catalog=full) ${call.what} on A's store: FORBIDDEN`,
    request: (a, b) => requestOf(call, of(a), a, b),
    expect: { kind: 'forbidden' },
    reverse: call.access === 'read by id',
  })),
);

/**
 * The stock list of the default channel narrowed to the seeded collections' ids, so the census covers every one of them
 * however many collections the default channel holds (no page can hide one). The options travel as a typed variable,
 * so Vendure decodes the ids of its `IDOperators`.
 */
/** A's collections on its first store: the catalog's manual one and the automatic one (the third is on store 2). */
const FIRST_STORE_COLLECTIONS = 2;
const DEFAULT_LIST = `query ($options: CollectionListOptions) {
  collections(options: $options) { totalItems items { id name slug } }
}`;
/**
 * The default channel holds none of the seeded collections (D2333): the superadmin's stock list of them answers
 * `totalItems: 0`, and the leak scanner finds none of either business's collection titles in it.
 */
const DEFAULT_CHANNEL_CASES: readonly IsolationCase[] = [
  {
    id: 'collections.default-channel.admin',
    entity: 'collection',
    endpoint: 'collections',
    access: 'list',
    title: "The superadmin lists stock collections on the default channel: none of A's or B's collections",
    request: (a, b, world): MatrixRequest => ({
      method: 'POST',
      path: '/admin-api',
      caller: world.superadmin,
      body: { query: DEFAULT_LIST, variables: seededCollectionsFilter([a, b]) },
    }),
    expect: { kind: 'own', mustInclude: () => ['"totalItems":0'] },
    reverse: true,
  },
  {
    // The control: the same filter finds A's collections where they live, so 0 above means absent, not a dead filter.
    id: 'collections.default-channel.admin-control',
    entity: 'collection',
    endpoint: 'collections',
    access: 'list',
    title: "The superadmin lists, with the same filter, stock collections on A's first store: A's two collections",
    request: (a, _b, world): MatrixRequest => ({
      method: 'POST',
      path: '/admin-api',
      caller: world.superadmin,
      channel: ownChannel(a),
      body: { query: DEFAULT_LIST, variables: seededCollectionsFilter([a]) },
    }),
    expect: {
      kind: 'own',
      mustInclude: (a) => [
        `"totalItems":${String(FIRST_STORE_COLLECTIONS)}`,
        `"id":"${catalogOf(a).collection.id}"`,
        `"id":"${collectionsOf(a).automatic.id}"`,
      ],
    },
    reverse: true,
  },
];

/** Every stock and default-channel collections cell. */
export const COLLECTION_STOCK_CASES: readonly IsolationCase[] = [...STOCK_CASES, ...DEFAULT_CHANNEL_CASES];
