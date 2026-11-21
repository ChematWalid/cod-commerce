import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { failureOf } from '@cod/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type CollectionResult, createCollection, rawId } from './collections-api';
import { collectionsSuite } from './collections-kit';
import { SET_COLLECTION_PRODUCTS } from './collections-products';

const suite = collectionsSuite(1019, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
/** Text a database or Vendure fault carries that no client may read (D2136). */
const LEAKS = [/collections_member/i, /relation/i, /does not exist/i, /QueryFailedError/, /select /i, /\s+at /];

describe('faults reach no client as internal text (D2136)', () => {
  let collection: CollectionResult;

  // A table the write uses disappears: a database fault the plugin cannot foresee.
  const breakMembers = () => suite.kit.query('ALTER TABLE "collections_member" RENAME TO "collections_member_gone"');
  const repairMembers = () =>
    suite.kit.query('ALTER TABLE IF EXISTS "collections_member_gone" RENAME TO "collections_member"');

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.a);
    collection = await createCollection(suite.kit);
  });

  afterEach(async () => {
    await repairMembers();
  });

  it('answers a GraphQL fault with INTERNAL_SERVER_ERROR and no internal text', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await breakMembers();

    // Act
    const call = () => suite.kit.gql(SET_COLLECTION_PRODUCTS, { id: collection.id, productIds: [] });
    const failure = await failureOf(call());
    const raw = JSON.stringify(await call().catch((error: unknown) => error));

    // Assert
    expect(failure.codes).toEqual(['INTERNAL_SERVER_ERROR']);
    for (const leak of LEAKS) expect(raw).not.toMatch(leak);
  });

  it('answers a REST fault with a bare 500 and no internal text', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await breakMembers();

    // Act
    const answer = await suite.kit.rest('GET', `/catalog/collections/${rawId(collection.id)}/products`);

    // Assert
    expect(answer.status).toBe(500);
    for (const leak of LEAKS) expect(answer.text).not.toMatch(leak);
  });

  it('answers a malformed body with the collections code, never a parser message', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await suite.kit.rest('PUT', `/catalog/collections/${rawId(collection.id)}/products`, {
      productIds: 'not a list',
    });

    // Assert
    expect(answer.status).toBe(400);
    expect(answer.body).toMatchObject({ code: COLLECTIONS_ERROR_CODES.INVALID_INPUT });
    for (const leak of LEAKS) expect(answer.text).not.toMatch(leak);
  });
});
