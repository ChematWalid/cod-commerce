import { catalogOf } from './catalog-world';
import { type Caller, fieldOf, type IsolationHttp } from './http';
import { CREATE_CATALOG_PRODUCT, CREATE_STORE_COLLECTION, SET_STORE_COLLECTION_PRODUCTS } from './seed-operations';
import type { BusinessWorld, WorldStore } from './world-types';

/** A collection of the world: its Vendure id (GraphQL form) and its title. */
export interface WorldCollection {
  readonly id: string;
  readonly title: string;
}

/**
 * The collections rows (plugins/collections-rules, P2.S3) of one business beyond the catalog's manual collection
 * (`CatalogWorld.collection`, which `seedCollections` fills with two products). Seeded through the collections Admin
 * API as the owner (D2330); titles carry the business id, so they are unique to the run like the rest of the world.
 */
export interface CollectionsWorld {
  /** Automatic, first store: "Tag is any of [the business's tag]", so it holds the catalog product only. */
  readonly automatic: WorldCollection;
  /** Manual and empty, second store: the first store's lists and options must never show it. */
  readonly otherStore: WorldCollection;
  /** A second product of the first store, in the manual collection beside the catalog product (untagged). */
  readonly secondProduct: { readonly id: string; readonly title: string };
}

/** The collections rows of businesses A and B, filled by the controller with {@link seedCollections}. */
export const COLLECTION_WORLDS = new Map<'A' | 'B', CollectionsWorld>();

const SECOND_PRODUCT_PRICE = 900;
const AUTOMATIC_POSITION = 1;

/** A stored rule (D2303) every product carrying `tagId` matches. */
export const tagRule = (tagId: string) => ({
  version: 1,
  match: 'all',
  conditions: [{ field: 'tag', operator: 'is_any_of', values: [tagId] }],
});

/** A stored rule (D2303) every product of the brand `brandId` matches. */
export const brandRule = (brandId: string) => ({
  version: 1,
  match: 'all',
  conditions: [{ field: 'brand', operator: 'is_any_of', values: [brandId] }],
});

/** The world's session on `store`. */
const channelOf = (store: WorldStore) => ({ label: store.label, token: store.channelToken });

/** One collections or catalog call as `owner` on `store`, answering the operation's field. */
async function call<T>(
  http: IsolationHttp,
  owner: Caller,
  store: WorldStore,
  request: { readonly query: string; readonly variables: Record<string, unknown>; readonly field: string },
): Promise<T> {
  return fieldOf(await http.graphql(owner, request.query, request.variables, channelOf(store)), request.field) as T;
}

/** Creates a collection of `store` as `business`'s owner. */
async function createCollection(
  http: IsolationHttp,
  business: BusinessWorld,
  store: WorldStore,
  input: Record<string, unknown> & { readonly title: string },
): Promise<WorldCollection> {
  const variables = { input: { visible: true, position: 0, mode: 'manual', ...input } };
  const created = await call<{ id: string }>(http, business.owner, store, {
    query: CREATE_STORE_COLLECTION,
    variables,
    field: 'createStoreCollection',
  });
  return { id: created.id, title: input.title };
}

/**
 * Seeds `business`'s collections: a second product, both products in the catalog's manual collection (in that order),
 * an automatic collection on its own tag, and an empty manual collection on the second store. Runs after `seedCatalog`.
 *
 * @throws Error when a call fails or a business has no catalog rows.
 */
export async function seedCollections(http: IsolationHttp, business: BusinessWorld): Promise<CollectionsWorld> {
  const [first, second] = business.stores;
  const catalog = catalogOf(business);
  const name = `${business.label} ${business.businessId}`;
  const title = `Second product ${name}`;
  const slug = `iso-second-${business.label.toLowerCase()}-${business.businessId}`;
  const saved = await call<{ product: { id: string } }>(http, business.owner, first, {
    query: CREATE_CATALOG_PRODUCT,
    variables: { input: { title, slug, status: 'active', price: SECOND_PRODUCT_PRICE } },
    field: 'createCatalogProduct',
  });
  await call(http, business.owner, first, {
    query: SET_STORE_COLLECTION_PRODUCTS,
    variables: { id: catalog.collection.id, productIds: [catalog.product.id, saved.product.id] },
    field: 'setStoreCollectionProducts',
  });
  const automatic = await createCollection(http, business, first, {
    title: `Automatic ${name}`,
    slug: `automatic-${first.id}`,
    position: AUTOMATIC_POSITION,
    mode: 'automatic',
    rule: tagRule(catalog.tag.id),
  });
  const otherStore = await createCollection(http, business, second, {
    title: `Second store collection ${name}`,
    slug: `collection-${second.id}`,
  });
  return { automatic, otherStore, secondProduct: { id: saved.product.id, title } };
}

/** The collections rows of `business`. @throws Error when the controller has not run {@link seedCollections}. */
export function collectionsOf(business: BusinessWorld): CollectionsWorld {
  const collections = COLLECTION_WORLDS.get(business.label);
  if (collections === undefined) {
    throw new Error(`no collections rows for business ${business.label}: seedCollections must run`);
  }
  return collections;
}

/** The Vendure ids (GraphQL form) of every collection seeded for `business`, on both of its stores. */
export const seededCollectionIdsOf = (business: BusinessWorld): string[] => [
  catalogOf(business).collection.id,
  collectionsOf(business).automatic.id,
  collectionsOf(business).otherStore.id,
];

/**
 * The variables of a stock `collections(options: $options)` list narrowed to every collection seeded for `businesses`.
 * The page holds them all (`take` = their count), which also keeps the Shop API's query complexity under its cap.
 */
export function seededCollectionsFilter(businesses: readonly BusinessWorld[]) {
  const ids = businesses.flatMap(seededCollectionIdsOf);
  return { options: { take: ids.length, filter: { id: { in: ids } } } };
}

/** Every value that identifies `collections`' rows, for the leak scanner (the manual one is the catalog's). */
export const collectionsFingerprints = (collections: CollectionsWorld): string[] => [
  collections.automatic.title,
  collections.otherStore.title,
  collections.secondProduct.title,
];

/** What an owner's snapshot reads of the collections of one store (with `snapshotOf`'s fields). */
export const COLLECTIONS_SNAPSHOT_FIELDS = `
  storeCollections {
    totalItems
    items {
      id title slug description visible position mode productCount featuredAsset { id }
      rule { version match conditions { field operator option values min max value } }
    }
  }
`;
