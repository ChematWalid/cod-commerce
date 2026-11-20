import { catalogOf } from '../catalog-world';
import { collectionsOf } from '../collections-world';
import type { MatrixRequest } from '../http';
import { type IsolationCase, onChannel, ownerGraphql, ownerRest } from '../matrix';
import type { BusinessWorld } from '../world-types';

/**
 * The collections reads of the P2 matrix (P2.S3) that answer with the caller's own rows: each holds A's seeded
 * collections or products (a positive control) and none of B's (the leak scanner), and the first store's reads hold
 * nothing of the second store's collection, and back (the store switch, D2132). `catalogCollectionOptions` is the
 * catalog's list filter, served by the collections plugin's registered source (D2324, Task 10 Step 2b).
 */

const LIST = 'query { storeCollections { totalItems items { id title } } }';
const OPTIONS = 'query { catalogCollectionOptions { id title } }';
const PRODUCTS = 'query ($id: ID!) { storeCollectionProducts(id: $id) { totalItems items { productId title } } }';
const OF_PRODUCT = `query ($productId: ID!) {
  storeProductCollections(productId: $productId) { manual { id title } automatic { id title } }
}`;
const RULE_OPTIONS =
  'query { storeCollectionRuleOptions { brands { id name } tags { id name } options { name values } } }';
const SEARCH = `query { storeCollectionProductSearch(options: { take: 100 }) { totalItems items { productId title } } }`;
const SLUG = `query ($slug: String!) { storeCollectionSlugAvailability(slug: $slug) { slug available } }`;

/** The titles of A's first-store collections. */
const firstStoreTitles = (a: BusinessWorld): string[] => [
  catalogOf(a).collection.name,
  collectionsOf(a).automatic.title,
];

const secondStore = (business: BusinessWorld): NonNullable<MatrixRequest['channel']> => ({
  label: business.stores[1].label,
  token: business.stores[1].channelToken,
});

/** A read of A's owner answering A's own rows: `mustInclude`, and never `mustExclude`. */
function ownRead(
  { id, endpoint, title }: { readonly id: string; readonly endpoint: string; readonly title: string },
  request: IsolationCase['request'],
  expect: { mustInclude: (a: BusinessWorld) => string[]; mustExclude?: (a: BusinessWorld) => string[] },
): IsolationCase {
  return {
    id: `collections.${id}`,
    entity: 'collection',
    endpoint,
    access: 'list',
    title: `A's owner ${title}`,
    request,
    expect: { kind: 'own', ...expect },
    reverse: true,
  };
}

const SECOND_STORE_ONLY = {
  mustInclude: (a: BusinessWorld) => [collectionsOf(a).otherStore.title],
  mustExclude: firstStoreTitles,
};
const FIRST_STORE_ONLY = {
  mustInclude: firstStoreTitles,
  mustExclude: (a: BusinessWorld) => [collectionsOf(a).otherStore.title],
};

/** Every collections read answered with the caller's own rows. */
export const COLLECTION_LIST_CASES: readonly IsolationCase[] = [
  ownRead(
    { id: 'storeCollections.own', endpoint: 'storeCollections', title: "lists A's first-store collections" },
    (a) => ownerGraphql(a, LIST),
    FIRST_STORE_ONLY,
  ),
  ownRead(
    {
      id: 'get-/catalog/collections.own',
      endpoint: 'GET /catalog/collections',
      title: "lists A's first-store collections over REST",
    },
    (a) => ownerRest(a, 'GET', '/catalog/collections'),
    FIRST_STORE_ONLY,
  ),
  ownRead(
    {
      id: 'storeCollections.second-store',
      endpoint: 'storeCollections',
      title: "lists A's second-store collections only",
    },
    (a) => onChannel(ownerGraphql(a, LIST), secondStore(a)),
    SECOND_STORE_ONLY,
  ),
  ownRead(
    {
      id: 'catalogCollectionOptions.own',
      endpoint: 'catalogCollectionOptions',
      title: "reads the list filter's collections",
    },
    (a) => ownerGraphql(a, OPTIONS),
    FIRST_STORE_ONLY,
  ),
  ownRead(
    {
      id: 'catalogCollectionOptions.second-store',
      endpoint: 'catalogCollectionOptions',
      title: "reads the list filter's collections on A's second store",
    },
    (a) => onChannel(ownerGraphql(a, OPTIONS), secondStore(a)),
    SECOND_STORE_ONLY,
  ),
  ownRead(
    {
      id: 'storeCollectionProducts.own-manual',
      endpoint: 'storeCollectionProducts',
      title: "reads A's manual collection: both of A's products",
    },
    (a) => ownerGraphql(a, PRODUCTS, { id: catalogOf(a).collection.id }),
    { mustInclude: (a) => [catalogOf(a).product.title, collectionsOf(a).secondProduct.title] },
  ),
  ownRead(
    {
      id: 'storeCollectionProducts.own-automatic',
      endpoint: 'storeCollectionProducts',
      title: "reads A's tag collection: A's tagged product only",
    },
    (a) => ownerGraphql(a, PRODUCTS, { id: collectionsOf(a).automatic.id }),
    { mustInclude: (a) => [catalogOf(a).product.title], mustExclude: (a) => [collectionsOf(a).secondProduct.title] },
  ),
  ownRead(
    {
      id: 'storeProductCollections.own',
      endpoint: 'storeProductCollections',
      title: "reads the collections of A's product: manual and by rule",
    },
    (a) => ownerGraphql(a, OF_PRODUCT, { productId: catalogOf(a).product.id }),
    {
      mustInclude: (a) => [catalogOf(a).collection.name, collectionsOf(a).automatic.title],
      mustExclude: (a) => [collectionsOf(a).otherStore.title],
    },
  ),
  ownRead(
    {
      id: 'storeCollectionRuleOptions.own',
      endpoint: 'storeCollectionRuleOptions',
      title: "reads A's rule builder options",
    },
    (a) => ownerGraphql(a, RULE_OPTIONS),
    { mustInclude: (a) => [catalogOf(a).tag.id, catalogOf(a).brand.id] },
  ),
  ownRead(
    {
      id: 'storeCollectionProductSearch.own',
      endpoint: 'storeCollectionProductSearch',
      title: "searches A's products to add",
    },
    (a) => ownerGraphql(a, SEARCH),
    { mustInclude: (a) => [catalogOf(a).product.title, collectionsOf(a).secondProduct.title] },
  ),
  ownRead(
    {
      id: 'storeCollectionSlugAvailability.foreign-slug',
      endpoint: 'storeCollectionSlugAvailability',
      title: "checks B's collection slug in A's store: available (a slug is per store, D2319)",
    },
    (a, b) => ownerGraphql(a, SLUG, { slug: catalogOf(b).collection.slug }),
    { mustInclude: () => ['"available":true'] },
  ),
  ownRead(
    {
      id: 'storeCollectionSlugAvailability.own-slug',
      endpoint: 'storeCollectionSlugAvailability',
      title: "checks A's own collection slug: taken (positive control)",
    },
    (a) => ownerGraphql(a, SLUG, { slug: catalogOf(a).collection.slug }),
    { mustInclude: (a) => ['"available":false', catalogOf(a).collection.slug] },
  ),
];
