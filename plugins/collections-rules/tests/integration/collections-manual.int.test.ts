import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES, COLLECTION_MAX_MANUAL_PRODUCTS, COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { TransactionalConnection } from '@vendure/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { codeOf, createCollection, rawId } from './collections-api';
import { collectionsSuite } from './collections-kit';
import {
  collectionsOfProduct,
  createProduct,
  makeAutomatic,
  productIdsOf,
  SET_COLLECTION_PRODUCTS,
  SET_PRODUCT_COLLECTIONS,
  UPDATE_PRODUCT,
} from './collections-products';

const suite = collectionsSuite(1018, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const C = COLLECTIONS_ERROR_CODES;

/** How long the racing product save gets to reach the store lock before the mode switch commits. */
const RACE_HEAD_START_MS = 500;

/** The positions of a collection's member rows, read past the API. */
async function positionsOf(collectionId: string): Promise<number[]> {
  const rows = await suite.kit.query<{ position: number }>(
    'SELECT position FROM collections_member WHERE "collectionId" = $1 ORDER BY position',
    [rawId(collectionId)],
  );
  return rows.map((row) => row.position);
}

describe('manual collections (D2318, D2309)', () => {
  let p1: string;
  let p2: string;
  let p3: string;

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.a);
    [p1, p2, p3] = [
      await createProduct(suite.kit, 'First'),
      await createProduct(suite.kit, 'Second'),
      await createProduct(suite.kit, 'Third'),
    ];
  });

  it('manual products keep their order', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { id } = await createCollection(suite.kit);

    // Act
    await suite.kit.gql(SET_COLLECTION_PRODUCTS, { id, productIds: [p3, p1, p2] });
    const first = await productIdsOf(suite.kit, id);
    const rest = await suite.kit.rest('PUT', `/catalog/collections/${rawId(id)}/products`, {
      productIds: [rawId(p1), rawId(p3)],
    });
    const restRead = await suite.kit.rest('GET', `/catalog/collections/${rawId(id)}/products`);

    // Assert
    expect(first).toEqual([p3, p1, p2]);
    expect(rest).toMatchObject({ status: 200, body: { productCount: 2 } });
    expect(await productIdsOf(suite.kit, id)).toEqual([p1, p3]);
    expect((restRead.body as { items: { productId: string }[] }).items.map((item) => item.productId)).toEqual([
      rawId(p1),
      rawId(p3),
    ]);
  });

  it('product editor additions append', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { id } = await createCollection(suite.kit);
    await suite.kit.gql(SET_COLLECTION_PRODUCTS, { id, productIds: [p1] });

    // Act
    await suite.kit.gql(UPDATE_PRODUCT, { id: p2, input: { collectionIds: [id] } });
    await suite.kit.gql(SET_PRODUCT_COLLECTIONS, { productId: p3, collectionIds: [id] });

    // Assert
    expect(await productIdsOf(suite.kit, id)).toEqual([p1, p2, p3]);
    expect(await positionsOf(id)).toEqual([0, 1, 2]);
  });

  it('product editor save keeps automatic memberships and refuses to name an automatic collection', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const automatic = await createCollection(suite.kit);
    await makeAutomatic(suite.kit, rawId(automatic.id), [rawId(p1)]);

    // Act
    await suite.kit.gql(UPDATE_PRODUCT, { id: p1, input: { collectionIds: [] } });
    const naming = await codeOf(suite.kit.gql(UPDATE_PRODUCT, { id: p1, input: { collectionIds: [automatic.id] } }));
    const ours = await codeOf(suite.kit.gql(SET_PRODUCT_COLLECTIONS, { productId: p1, collectionIds: [automatic.id] }));

    // Assert
    expect((await collectionsOfProduct(suite.kit, p1)).automatic.map((ref) => ref.id)).toEqual([automatic.id]);
    expect(naming).toBe(CATALOG_ERROR_CODES.COLLECTION_NOT_FOUND);
    expect(ours).toBe(C.NOT_MANUAL);
  });

  it('setStoreCollectionProducts refuses an automatic collection with not-manual', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const automatic = await createCollection(suite.kit);
    await makeAutomatic(suite.kit, rawId(automatic.id));

    // Act
    const code = await codeOf(suite.kit.gql(SET_COLLECTION_PRODUCTS, { id: automatic.id, productIds: [p1] }));

    // Assert
    expect(code).toBe(C.NOT_MANUAL);
  });

  it("refuses B's, the other store's, a deleted and a malformed product and writes nothing", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const ofB = await createProduct(suite.kit, 'B product');
    await suite.kit.asOwner(a, a.stores[1]);
    const ofA2 = await createProduct(suite.kit, 'Second store product');
    await suite.kit.asOwner(a);
    const deleted = await createProduct(suite.kit, 'Deleted');
    await suite.kit.rest('DELETE', `/catalog/products/${rawId(deleted)}`);
    const { id } = await createCollection(suite.kit);
    await suite.kit.gql(SET_COLLECTION_PRODUCTS, { id, productIds: [p2] });

    // Act
    const codes = [];
    for (const foreign of [ofB, ofA2, deleted, 'abc']) {
      codes.push(await codeOf(suite.kit.gql(SET_COLLECTION_PRODUCTS, { id, productIds: [p1, foreign] })));
    }
    const rest = await suite.kit.rest('PUT', `/catalog/collections/${rawId(id)}/products`, {
      productIds: [rawId(p1), rawId(ofB)],
    });

    // Assert
    expect(codes).toEqual(Array.from({ length: 4 }, () => C.PRODUCT_NOT_FOUND));
    expect(rest).toMatchObject({ status: 404, body: { code: C.PRODUCT_NOT_FOUND } });
    expect(await productIdsOf(suite.kit, id)).toEqual([p2]);
  });

  it('refuses more than the manual cap of products in one set (too-many-products)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { id } = await createCollection(suite.kit);
    const ids = Array.from({ length: COLLECTION_MAX_MANUAL_PRODUCTS + 1 }, (_, index) => String(index + 1));

    // Act
    const code = await codeOf(suite.kit.gql(SET_COLLECTION_PRODUCTS, { id, productIds: ids }));
    const rest = await suite.kit.rest('PUT', `/catalog/collections/${rawId(id)}/products`, { productIds: ids });

    // Assert
    expect(code).toBe(C.TOO_MANY_PRODUCTS);
    expect(rest).toMatchObject({ status: 400, body: { code: C.TOO_MANY_PRODUCTS } });
  });

  it('editor append respects the 500 manual cap (too-many-products)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { id } = await createCollection(suite.kit);
    await suite.kit.query(
      `INSERT INTO collections_member ("businessId", "storeId", "id", "collectionId", "productId", "position")
       SELECT d."businessId", d."storeId", 1600000000000000000 + n, d."collectionId", 900000 + n, n - 1
       FROM collections_definition d, generate_series(1, $2::int) AS n WHERE d."collectionId" = $1`,
      [rawId(id), COLLECTION_MAX_MANUAL_PRODUCTS],
    );

    // Act
    const ours = await codeOf(suite.kit.gql(SET_PRODUCT_COLLECTIONS, { productId: p1, collectionIds: [id] }));
    const catalog = await codeOf(suite.kit.gql(UPDATE_PRODUCT, { id: p1, input: { collectionIds: [id] } }));

    // Assert
    expect(ours).toBe(C.TOO_MANY_PRODUCTS);
    expect(catalog).toBe(CATALOG_ERROR_CODES.INVALID_INPUT);
    expect(await positionsOf(id)).toHaveLength(COLLECTION_MAX_MANUAL_PRODUCTS);
  });

  it('parallel appends get distinct positions', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { id } = await createCollection(suite.kit);

    // Act
    await Promise.all(
      [p1, p2, p3].map((productId) => suite.kit.gql(SET_PRODUCT_COLLECTIONS, { productId, collectionIds: [id] })),
    );

    // Assert
    expect(await positionsOf(id)).toEqual([0, 1, 2]);
  });

  it('a product write racing a mode switch never links an automatic collection', async () => {
    // Arrange: a mode switch holds the store lock (D2334) while the product save checks the collection, still manual.
    await suite.kit.asOwner(suite.fixtures.a);
    const { id } = await createCollection(suite.kit);
    const runner = suite.kit.app.get(TransactionalConnection).rawConnection.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    await runner.query("SELECT pg_advisory_xact_lock(hashtextextended('collections-store:' || $1, 0))", [
      suite.fixtures.a.stores[0].id,
    ]);
    await runner.query(`UPDATE collections_definition SET mode = 'automatic' WHERE "collectionId" = $1`, [rawId(id)]);

    // Act
    const save = codeOf(suite.kit.gql(UPDATE_PRODUCT, { id: p1, input: { collectionIds: [id] } }));
    await new Promise((resolve) => setTimeout(resolve, RACE_HEAD_START_MS));
    await runner.commitTransaction();
    await runner.release();
    const code = await save;

    // Assert
    expect(code).toBe(CATALOG_ERROR_CODES.COLLECTION_NOT_FOUND);
    expect(await positionsOf(id)).toEqual([]);
  });
});
