import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { restTargetOf, targetOf } from '../catalog-operations';
import { catalogOf, restIdOf } from '../catalog-world';
import { COLLECTION_OPERATIONS, COLLECTION_ROUTES } from '../collections-operations';
import { tagRule } from '../collections-world';
import { type IsolationCase, ownerGraphql, ownerRest } from '../matrix';
import type { BusinessWorld } from '../world-types';
import { sweepCasesOf } from './endpoint-sweep';

/**
 * The collections cells of the P2 matrix (P2.S3): the generated sweep of every endpoint (B's collection or product
 * by id over GraphQL and REST, both directions; B's store token; A's store-restricted member on A's second store;
 * malformed ids), then A's own writes and previews naming B's rows: a rule naming B's tag or brand matches nothing
 * (D2307), and a membership write naming B's product, collection or image is refused and writes nothing.
 */

const C = COLLECTIONS_ERROR_CODES;
const NOT_FOUND = 404;
/** What a list, a preview or a collection's products answer when nothing matches. */
const NOTHING = '"totalItems":0';

const PREVIEW = `query ($input: StoreCollectionPreviewInput!) {
  previewStoreCollectionMatches(input: $input) { totalItems items { productId title } }
}`;
const SET_PRODUCTS = `mutation ($id: ID!, $productIds: [ID!]!) {
  setStoreCollectionProducts(id: $id, productIds: $productIds) { id productCount }
}`;
const SET_PRODUCT_COLLECTIONS = `mutation ($productId: ID!, $collectionIds: [ID!]!) {
  setStoreProductCollections(productId: $productId, collectionIds: $collectionIds) { manual { id } }
}`;
const UPDATE = `mutation ($id: ID!, $input: UpdateStoreCollectionInput!) {
  updateStoreCollection(id: $id, input: $input) { id }
}`;

/** A rule naming one brand (D2303). */
const brandRule = (brandId: string) => ({
  version: 1,
  match: 'all',
  conditions: [{ field: 'brand', operator: 'is_any_of', values: [brandId] }],
});

/** A preview on A's store of a rule naming B's row: it must match none of A's products and leak none of B's. */
function previewNaming(row: 'tag' | 'brand', rule: (b: BusinessWorld) => unknown): IsolationCase {
  return {
    id: `collections.previewStoreCollectionMatches.foreign-${row}`,
    entity: 'collection',
    endpoint: 'previewStoreCollectionMatches',
    access: 'list',
    title: `A's owner previews a rule naming B's ${row}: no product matches`,
    request: (a, b) => ownerGraphql(a, PREVIEW, { input: { rule: rule(b) } }),
    expect: { kind: 'own', mustInclude: () => [NOTHING] },
    reverse: true,
  };
}

/** The parts of a write cell that differ from one write of A's own rows naming one of B's to the next. */
type NamingWrite = Pick<IsolationCase, 'id' | 'endpoint' | 'title' | 'request' | 'expect'>;

/** A write of A's own rows naming one of B's: it must answer the expected refusal and change nothing. */
const writeNaming = (cell: NamingWrite): IsolationCase => ({
  ...cell,
  id: `collections.${cell.id}`,
  entity: 'collection',
  access: 'write',
  title: `A's owner ${cell.title}`,
  reverse: true,
});

const NAMING_CASES: readonly IsolationCase[] = [
  previewNaming('tag', (b) => tagRule(catalogOf(b).tag.id)),
  previewNaming('brand', (b) => brandRule(catalogOf(b).brand.id)),
  {
    id: 'collections.previewStoreCollectionMatches.own-tag',
    entity: 'collection',
    endpoint: 'previewStoreCollectionMatches',
    access: 'list',
    title: "A's owner previews a rule naming A's tag: A's product matches (positive control)",
    request: (a) => ownerGraphql(a, PREVIEW, { input: { rule: tagRule(catalogOf(a).tag.id) } }),
    expect: { kind: 'own', mustInclude: (a) => [catalogOf(a).product.title] },
  },
  {
    id: 'collections.post-/catalog/collections/preview.foreign-tag',
    entity: 'collection',
    endpoint: 'POST /catalog/collections/preview',
    access: 'list',
    title: "A's owner previews over REST a rule naming B's tag: no product matches",
    request: (a, b) => ownerRest(a, 'POST', '/catalog/collections/preview', { rule: tagRule(catalogOf(b).tag.id) }),
    expect: { kind: 'own', mustInclude: () => [NOTHING] },
    reverse: true,
  },
  writeNaming({
    id: 'setStoreCollectionProducts.foreign-product',
    endpoint: 'setStoreCollectionProducts',
    title: "sets B's product into A's manual collection: product not found",
    request: (a, b) =>
      ownerGraphql(a, SET_PRODUCTS, {
        id: catalogOf(a).collection.id,
        productIds: [catalogOf(a).product.id, catalogOf(b).product.id],
      }),
    expect: { kind: 'code', code: C.PRODUCT_NOT_FOUND },
  }),
  writeNaming({
    id: 'setStoreProductCollections.foreign-collection',
    endpoint: 'setStoreProductCollections',
    title: "puts A's product into B's collection: not found",
    request: (a, b) =>
      ownerGraphql(a, SET_PRODUCT_COLLECTIONS, {
        productId: catalogOf(a).product.id,
        collectionIds: [catalogOf(a).collection.id, catalogOf(b).collection.id],
      }),
    expect: { kind: 'code', code: C.NOT_FOUND },
  }),
  writeNaming({
    id: 'updateStoreCollection.foreign-image',
    endpoint: 'updateStoreCollection',
    title: "gives A's collection B's image: image not found",
    request: (a, b) =>
      ownerGraphql(a, UPDATE, {
        id: catalogOf(a).collection.id,
        input: { featuredAssetId: catalogOf(b).media.assetId },
      }),
    expect: { kind: 'code', code: C.IMAGE_NOT_FOUND },
  }),
  writeNaming({
    id: 'put-/catalog/collections/:id/products.foreign-product',
    endpoint: 'PUT /catalog/collections/:id/products',
    title: "sets B's product into A's manual collection over REST: 404 product not found",
    request: (a, b) =>
      ownerRest(a, 'PUT', `/catalog/collections/${restIdOf(catalogOf(a).collection.id)}/products`, {
        productIds: [catalogOf(a).product.restId, catalogOf(b).product.restId],
      }),
    expect: { kind: 'status', status: NOT_FOUND, code: C.PRODUCT_NOT_FOUND },
  }),
  writeNaming({
    id: 'put-/catalog/collections/of-product/:productId.foreign-collection',
    endpoint: 'PUT /catalog/collections/of-product/:productId',
    title: "puts A's product into B's collection over REST: 404 not found",
    request: (a, b) =>
      ownerRest(a, 'PUT', `/catalog/collections/of-product/${catalogOf(a).product.restId}`, {
        collectionIds: [restIdOf(catalogOf(a).collection.id), restIdOf(catalogOf(b).collection.id)],
      }),
    expect: { kind: 'status', status: NOT_FOUND, code: C.NOT_FOUND },
  }),
];

/** Every collections sweep cell. */
export const COLLECTION_SWEEP_CASES: readonly IsolationCase[] = [
  ...sweepCasesOf({
    prefix: 'collections',
    operations: COLLECTION_OPERATIONS,
    routes: COLLECTION_ROUTES,
    targetOf,
    restTargetOf,
  }),
  ...NAMING_CASES,
];
