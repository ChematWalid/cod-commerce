import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  COLLECTION,
  COLLECTIONS,
  codeOf,
  type CollectionResult,
  createCollection,
  DELETE_COLLECTION,
  rawId,
  UPDATE_COLLECTION,
} from './collections-api';
import { collectionsSuite } from './collections-kit';

const NOT_FOUND = COLLECTIONS_ERROR_CODES.NOT_FOUND;

const suite = collectionsSuite(1017, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

describe("collections of one business's two stores", () => {
  let inFirst: CollectionResult;

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.a);
    inFirst = await createCollection(suite.kit, { title: 'First store only' });
  });

  it("A's second store never lists or reads its first store's collections", async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);

    // Act
    const { storeCollections } = await suite.kit.gql<{ storeCollections: { totalItems: number } }>(COLLECTIONS);
    const { storeCollection } = await suite.kit.gql<{ storeCollection: unknown }>(COLLECTION, { id: inFirst.id });
    const rest = await suite.kit.rest('GET', `/catalog/collections/${rawId(inFirst.id)}`);
    const restList = await suite.kit.rest('GET', '/catalog/collections');

    // Assert
    expect(storeCollections.totalItems).toBe(0);
    expect(storeCollection).toBeNull();
    expect(rest).toMatchObject({ status: 404, body: { code: NOT_FOUND } });
    expect(restList.text).not.toContain(rawId(inFirst.id));
  });

  it("A's second store can neither edit nor delete its first store's collection", async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);
    const url = `/catalog/collections/${rawId(inFirst.id)}`;

    // Act
    const codes = [
      await codeOf(suite.kit.gql(UPDATE_COLLECTION, { id: inFirst.id, input: { title: 'Taken over' } })),
      await codeOf(suite.kit.gql(DELETE_COLLECTION, { id: inFirst.id })),
    ];
    const answers = [await suite.kit.rest('PATCH', url, { title: 'Taken over' }), await suite.kit.rest('DELETE', url)];

    // Assert
    expect(codes).toEqual([NOT_FOUND, NOT_FOUND]);
    for (const answer of answers) expect(answer).toMatchObject({ status: 404, body: { code: NOT_FOUND } });
  });

  it('the first store reads its own collection, unchanged (positive control)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const { storeCollection } = await suite.kit.gql<{ storeCollection: CollectionResult | null }>(COLLECTION, {
      id: inFirst.id,
    });
    const { storeCollections } = await suite.kit.gql<{ storeCollections: { items: CollectionResult[] } }>(COLLECTIONS);

    // Assert
    expect(storeCollection).toEqual(inFirst);
    expect(storeCollections.items.map((item) => item.id)).toContain(inFirst.id);
  });
});
