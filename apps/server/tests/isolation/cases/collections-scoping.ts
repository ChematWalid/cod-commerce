import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { type CatalogRoute, restTargetOf, targetOf } from '../catalog-operations';
import { catalogOf, restIdOf } from '../catalog-world';
import { COLLECTION_OPERATIONS, COLLECTION_ROUTES, SWEEP_SLUG } from '../collections-operations';
import { collectionsOf } from '../collections-world';
import type { MatrixRequest } from '../http';
import { type Expectation, type IsolationCase, ownChannel, ownerGraphql, ownerRest } from '../matrix';
import type { BusinessWorld } from '../world-types';
import { accessOf, notFoundOf, operationRequest, routeName, routeRequest } from './endpoint-sweep';

/**
 * Store scoping inside one business (D2132) and the slug check's collection id (P2.S3, Task 10 review). The owner,
 * who may reach both stores, names a collection of the business's other store by id: every by-id endpoint answers
 * "not found" (404 over REST), so a lookup scoped by business but not by store fails here, through the real server
 * wiring; the snapshots of both stores catch a write that slips through. Then `collectionId` of the slug check: B's id
 * never frees A's taken slug, and a malformed id names nothing (D2136).
 */

type Channel = NonNullable<MatrixRequest['channel']>;

const C = COLLECTIONS_ERROR_CODES;
const NOT_FOUND = 404;
/**
 * An id past the safe integers: the GraphQL `ID` decoding hands the plugin a number, which the input schema refuses as
 * `collections.invalid-input`; over REST it stays text and names nothing.
 */
const UNSAFE_NUMBER_ID = '99999999999999999999';
/** Malformed collection ids the slug check must ignore without reaching Postgres (D2136). */
const MALFORMED_COLLECTION_IDS = ['abc', '-1', UNSAFE_NUMBER_ID];

const secondStore = (business: BusinessWorld): Channel => ({
  label: business.stores[1].label,
  token: business.stores[1].channelToken,
});

/** One store of A naming a collection of A's other store. */
interface StoreCrossing {
  /** The last part of the cell id. */
  readonly name: string;
  readonly what: string;
  readonly channel: (business: BusinessWorld) => Channel;
  /** The named collection's id, GraphQL form. */
  readonly collectionId: (business: BusinessWorld) => string;
}

const CROSSINGS: readonly StoreCrossing[] = [
  {
    name: 'second-store-collection',
    what: "its second store's collection on its first store",
    channel: ownChannel,
    collectionId: (business) => collectionsOf(business).otherStore.id,
  },
  {
    name: 'first-store-manual',
    what: "its first store's manual collection on its second store",
    channel: secondStore,
    collectionId: (business) => catalogOf(business).collection.id,
  },
  {
    name: 'first-store-automatic',
    what: "its first store's automatic collection on its second store",
    channel: secondStore,
    collectionId: (business) => collectionsOf(business).automatic.id,
  },
];

const namesCollection = (byId: { readonly field: string } | undefined): boolean => byId?.field === 'collectionId';

function operationCrossings(crossing: StoreCrossing): IsolationCase[] {
  return COLLECTION_OPERATIONS.filter((op) => namesCollection(op.byId)).map((op) => ({
    id: `collections.${op.name}.${crossing.name}`,
    entity: 'collection',
    endpoint: op.name,
    access: accessOf(op),
    title: `A's owner calls ${op.name} on ${crossing.what}: not found`,
    request: (a) =>
      operationRequest(op, a.owner, crossing.channel(a), { ...targetOf(a), collectionId: crossing.collectionId(a) }),
    expect: notFoundOf(op),
    reverse: true,
  }));
}

function routeCrossings(crossing: StoreCrossing): IsolationCase[] {
  return COLLECTION_ROUTES.filter((route): route is CatalogRoute & { byId: NonNullable<CatalogRoute['byId']> } =>
    namesCollection(route.byId),
  ).map((route) => ({
    id: `collections.${route.method.toLowerCase()}-${route.route}.${crossing.name}`,
    entity: 'collection',
    endpoint: routeName(route),
    access: route.method === 'GET' ? 'read by id' : 'write',
    title: `A's owner calls ${routeName(route)} on ${crossing.what}: ${String(NOT_FOUND)}`,
    request: (a) =>
      routeRequest(route, a.owner, crossing.channel(a), {
        ...restTargetOf(a),
        collectionId: restIdOf(crossing.collectionId(a)),
      }),
    expect: { kind: 'status', status: NOT_FOUND, code: route.byId.notFound },
    reverse: true,
  }));
}

const SET_PRODUCT_COLLECTIONS = `mutation ($productId: ID!, $collectionIds: [ID!]!) {
  setStoreProductCollections(productId: $productId, collectionIds: $collectionIds) { manual { id } }
}`;

/** A's first-store product put into A's second-store collection: refused as not found, over GraphQL and REST. */
const PRODUCT_CROSSINGS: readonly IsolationCase[] = [
  {
    id: 'collections.setStoreProductCollections.second-store-collection',
    entity: 'collection',
    endpoint: 'setStoreProductCollections',
    access: 'write',
    title: "A's owner puts its first-store product into its second store's collection: not found",
    request: (a) =>
      ownerGraphql(a, SET_PRODUCT_COLLECTIONS, {
        productId: catalogOf(a).product.id,
        collectionIds: [catalogOf(a).collection.id, collectionsOf(a).otherStore.id],
      }),
    expect: { kind: 'code', code: C.NOT_FOUND },
    reverse: true,
  },
  {
    id: 'collections.put-/catalog/collections/of-product/:productId.second-store-collection',
    entity: 'collection',
    endpoint: 'PUT /catalog/collections/of-product/:productId',
    access: 'write',
    title: "A's owner puts over REST its first-store product into its second store's collection: 404 not found",
    request: (a) =>
      ownerRest(a, 'PUT', `/catalog/collections/of-product/${catalogOf(a).product.restId}`, {
        collectionIds: [restIdOf(catalogOf(a).collection.id), restIdOf(collectionsOf(a).otherStore.id)],
      }),
    expect: { kind: 'status', status: NOT_FOUND, code: C.NOT_FOUND },
    reverse: true,
  },
];

const SLUG = `query ($slug: String!, $collectionId: ID) {
  storeCollectionSlugAvailability(slug: $slug, collectionId: $collectionId) { slug available }
}`;
const slugPath = (slug: string, collectionId: string): string =>
  `/catalog/collections/slug-availability?slug=${slug}&collectionId=${encodeURIComponent(collectionId)}`;

/** One slug check of the matrix, over GraphQL and REST. */
interface SlugCheck {
  /** The last part of the cell id. */
  readonly name: string;
  readonly what: string;
  /** What both forms answer, unless `graphqlExpect` says otherwise for GraphQL. */
  readonly available: boolean;
  readonly of: (a: BusinessWorld, b: BusinessWorld) => { slug: string; collectionId: string; restId: string };
  readonly graphqlExpect?: Expectation;
}

/** A slug check on A's store naming `collectionId`: answers `available`, and leaks nothing of B's. */
function slugCells({ name, what, available, of, graphqlExpect }: SlugCheck): IsolationCase[] {
  const expect = { kind: 'own', mustInclude: () => [`"available":${String(available)}`] } as const;
  const answer = `available=${String(available)}`;
  const shared = { entity: 'collection', access: 'read by id', reverse: true } as const;
  return [
    {
      ...shared,
      id: `collections.storeCollectionSlugAvailability.${name}`,
      endpoint: 'storeCollectionSlugAvailability',
      title: `A's owner checks a slug ${what}: ${graphqlExpect === undefined ? answer : 'invalid input'}`,
      request: (a, b) => {
        const { slug, collectionId } = of(a, b);
        return ownerGraphql(a, SLUG, { slug, collectionId });
      },
      expect: graphqlExpect ?? expect,
    },
    {
      ...shared,
      id: `collections.get-/catalog/collections/slug-availability.${name}`,
      endpoint: 'GET /catalog/collections/slug-availability',
      title: `A's owner checks over REST a slug ${what}: ${answer}`,
      request: (a, b) => {
        const { slug, restId } = of(a, b);
        return ownerRest(a, 'GET', slugPath(slug, restId));
      },
      expect,
    },
  ];
}

const SLUG_CASES: readonly IsolationCase[] = [
  ...slugCells({
    name: 'foreign-collection-id',
    what: "its collection holds, naming B's collection",
    available: false,
    of: (a, b) => ({
      slug: catalogOf(a).collection.slug,
      collectionId: catalogOf(b).collection.id,
      restId: restIdOf(catalogOf(b).collection.id),
    }),
  }),
  ...MALFORMED_COLLECTION_IDS.flatMap((id) =>
    slugCells({
      name: `malformed-collection-id-${JSON.stringify(id)}`,
      what: `nobody holds, naming ${id}`,
      available: true,
      of: () => ({ slug: SWEEP_SLUG, collectionId: id, restId: id }),
      ...(id === UNSAFE_NUMBER_ID && { graphqlExpect: { kind: 'code', code: C.INVALID_INPUT } as const }),
    }),
  ),
];

/** Every store-scoping and slug-check collection-id cell. */
export const COLLECTION_SCOPING_CASES: readonly IsolationCase[] = [
  ...CROSSINGS.flatMap((crossing) => [...operationCrossings(crossing), ...routeCrossings(crossing)]),
  ...PRODUCT_CROSSINGS,
  ...SLUG_CASES,
];
