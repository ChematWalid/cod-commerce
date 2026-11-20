import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { failureOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { COLLECTIONS, CREATE_COLLECTION } from './collections-api';
import { collectionsSuite } from './collections-kit';
import { SET_PRODUCT_COLLECTIONS } from './collections-products';

const suite = collectionsSuite(1019, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const FORBIDDEN = 'FORBIDDEN';
const FORBIDDEN_STATUS = 403;
const NEW_COLLECTION = { title: 'x', slug: 'x', visible: true, position: 0, mode: 'manual' };

describe('archived stores and suspended businesses (TEN-3, D2117)', () => {
  /** Every handler kind refuses: GraphQL reads and writes, REST reads and writes. */
  async function refusals(): Promise<{ codes: readonly string[]; statuses: number[] }> {
    const read = await failureOf(suite.kit.gql(COLLECTIONS));
    const write = await failureOf(suite.kit.gql(CREATE_COLLECTION, { input: NEW_COLLECTION }));
    const link = await failureOf(suite.kit.gql(SET_PRODUCT_COLLECTIONS, { productId: '1', collectionIds: [] }));
    const statuses = [
      (await suite.kit.rest('GET', '/catalog/collections')).status,
      (await suite.kit.rest('POST', '/catalog/collections', NEW_COLLECTION)).status,
      (await suite.kit.rest('GET', '/catalog/collections/slug-availability?slug=x')).status,
      (await suite.kit.rest('PUT', '/catalog/collections/of-product/1', { collectionIds: [] })).status,
    ];
    return { codes: [...read.codes, ...write.codes, ...link.codes], statuses };
  }

  it('forbids every collections handler on an archived store', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.query(`UPDATE "store" SET "status" = 'archived' WHERE "id" = $1`, [a.stores[1].id]);
    await suite.kit.asOwner(a, a.stores[1]);

    // Act
    const answer = await refusals();

    // Assert
    expect(answer).toEqual({ codes: [FORBIDDEN, FORBIDDEN, FORBIDDEN], statuses: Array(4).fill(FORBIDDEN_STATUS) });
  });

  it('forbids every collections handler for a suspended business', async () => {
    // Arrange
    const { b } = suite.fixtures;
    await suite.kit.query(`UPDATE "business" SET "status" = 'suspended' WHERE "id" = $1`, [b.businessId]);
    await suite.kit.asOwner(b);

    // Act
    const answer = await refusals();

    // Assert
    expect(answer).toEqual({ codes: [FORBIDDEN, FORBIDDEN, FORBIDDEN], statuses: Array(4).fill(FORBIDDEN_STATUS) });
  });

  it('serves the active store of an active business (positive control)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await suite.kit.rest('GET', '/catalog/collections');

    // Assert
    expect(answer.status).toBe(200);
  });
});
