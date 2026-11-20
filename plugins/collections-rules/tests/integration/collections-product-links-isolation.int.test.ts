import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES, COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { codeOf, type CollectionResult, createCollection, rawId } from './collections-api';
import { collectionsSuite } from './collections-kit';
import {
  collectionsOfProduct,
  createProduct,
  SET_COLLECTION_PRODUCTS,
  SET_PRODUCT_COLLECTIONS,
  UPDATE_PRODUCT,
} from './collections-products';

const suite = collectionsSuite(1017, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const NOT_FOUND = COLLECTIONS_ERROR_CODES.NOT_FOUND;
const MALFORMED = 'abc';

const CATALOG_PRODUCTS = `query ($options: CatalogProductListInput) {
  catalogProducts(options: $options) { totalItems items { id } }
}`;

/** The collections holding a product, read past the API, so a write the API hides would still show. */
async function memberRowsOfProduct(productId: string): Promise<string[]> {
  const rows = await suite.kit.query<{ collectionId: string }>(
    'SELECT "collectionId"::text AS "collectionId" FROM collections_member WHERE "productId" = $1 ORDER BY 1',
    [rawId(productId)],
  );
  return rows.map((row) => row.collectionId);
}

/** The products of a collection, read past the API. */
async function memberRowsOfCollection(collectionId: string): Promise<string[]> {
  const rows = await suite.kit.query<{ productId: string }>(
    'SELECT "productId"::text AS "productId" FROM collections_member WHERE "collectionId" = $1 ORDER BY 1',
    [rawId(collectionId)],
  );
  return rows.map((row) => row.productId);
}

async function catalogProductIdsIn(collectionId: string): Promise<{ totalItems: number; ids: string[] }> {
  const { catalogProducts } = await suite.kit.gql<{
    catalogProducts: { totalItems: number; items: { id: string }[] };
  }>(CATALOG_PRODUCTS, { options: { collectionId } });
  return { totalItems: catalogProducts.totalItems, ids: catalogProducts.items.map((item) => item.id) };
}

describe("a product's collections name only its own store's collections (two businesses, two stores)", () => {
  let ofB: CollectionResult;
  let ofA2: CollectionResult;
  let own: CollectionResult;
  let productOfB: string;
  let p1: string;

  beforeAll(async () => {
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    ofB = await createCollection(suite.kit, { title: 'Of B' });
    productOfB = await createProduct(suite.kit, 'B product');
    await suite.kit.gql(SET_COLLECTION_PRODUCTS, { id: ofB.id, productIds: [productOfB] });
    await suite.kit.asOwner(a, a.stores[1]);
    ofA2 = await createCollection(suite.kit, { title: 'Of A2' });
    await suite.kit.asOwner(a);
    own = await createCollection(suite.kit, { title: 'Of A1' });
    p1 = await createProduct(suite.kit, 'A1 product');
    await suite.kit.gql(SET_PRODUCT_COLLECTIONS, { productId: p1, collectionIds: [own.id] });
  });

  /** Nothing moved: p1 is in its own collection only, B's collection still holds B's product, A2's holds none. */
  async function expectUnchanged(): Promise<void> {
    expect((await collectionsOfProduct(suite.kit, p1)).manual.map((ref) => ref.id)).toEqual([own.id]);
    expect(await memberRowsOfProduct(p1)).toEqual([rawId(own.id)]);
    expect(await memberRowsOfCollection(ofB.id)).toEqual([rawId(productOfB)]);
    expect(await memberRowsOfCollection(ofA2.id)).toEqual([]);
  }

  it("setStoreProductCollections refuses B's, the other store's and a malformed collection with not-found", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const codes = [];
    for (const foreign of [ofB.id, ofA2.id, MALFORMED]) {
      codes.push(
        await codeOf(suite.kit.gql(SET_PRODUCT_COLLECTIONS, { productId: p1, collectionIds: [own.id, foreign] })),
      );
    }

    // Assert
    expect(codes).toEqual([NOT_FOUND, NOT_FOUND, NOT_FOUND]);
    await expectUnchanged();
  });

  it("PUT of-product refuses B's, the other store's and a malformed collection with 404", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answers = [];
    for (const foreign of [rawId(ofB.id), rawId(ofA2.id), MALFORMED]) {
      answers.push(
        await suite.kit.rest('PUT', `/catalog/collections/of-product/${rawId(p1)}`, {
          collectionIds: [rawId(own.id), foreign],
        }),
      );
    }

    // Assert
    for (const answer of answers) expect(answer).toMatchObject({ status: 404, body: { code: NOT_FOUND } });
    await expectUnchanged();
  });

  it("the catalog product save refuses B's and the other store's collection through the registered source", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const codes = [];
    for (const foreign of [ofB.id, ofA2.id]) {
      codes.push(await codeOf(suite.kit.gql(UPDATE_PRODUCT, { id: p1, input: { collectionIds: [own.id, foreign] } })));
    }

    // Assert
    expect(codes).toEqual([CATALOG_ERROR_CODES.COLLECTION_NOT_FOUND, CATALOG_ERROR_CODES.COLLECTION_NOT_FOUND]);
    await expectUnchanged();
  });

  it("the catalog list filtered by B's or the other store's collection lists nothing", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const [byB, byA2, byOwn] = [
      await catalogProductIdsIn(ofB.id),
      await catalogProductIdsIn(ofA2.id),
      await catalogProductIdsIn(own.id),
    ];

    // Assert
    expect(byB).toEqual({ totalItems: 0, ids: [] });
    expect(byA2).toEqual({ totalItems: 0, ids: [] });
    expect(byOwn).toEqual({ totalItems: 1, ids: [p1] });
  });
});
