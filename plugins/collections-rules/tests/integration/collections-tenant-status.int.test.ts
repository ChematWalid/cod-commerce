import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import gql from 'graphql-tag';
import { describe, expect, it } from 'vitest';
import { codeOf } from './collections-api';
import { collectionsSuite } from './collections-kit';
import { OPERATION_REGISTRY, operationKey, ROUTE_REGISTRY, routeKey, type TargetIds } from './collections-registry';

const suite = collectionsSuite(1019, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const FORBIDDEN = 'FORBIDDEN';
const FORBIDDEN_STATUS = 403;
/** Any ids: the tenant guard refuses before a handler reads them. */
const ANY_IDS: TargetIds = { collectionId: '1', productId: '1' };

/** What every registered handler answers, keyed by operation or route, so a missing guard names its handler. */
async function answers(): Promise<Record<string, string | number | undefined>> {
  const found: Record<string, string | number | undefined> = {};
  for (const entry of OPERATION_REGISTRY) {
    found[operationKey(entry)] = await codeOf(suite.kit.client.query(gql(entry.document), entry.variables(ANY_IDS)));
  }
  for (const entry of ROUTE_REGISTRY) {
    found[routeKey(entry)] = (await suite.kit.rest(entry.method, entry.url(ANY_IDS), entry.body?.(ANY_IDS))).status;
  }
  return found;
}

/** Every registered handler refused: FORBIDDEN on GraphQL, 403 on REST. */
function everyRefusal(): Record<string, string | number> {
  const expected: Record<string, string | number> = {};
  for (const entry of OPERATION_REGISTRY) expected[operationKey(entry)] = FORBIDDEN;
  for (const entry of ROUTE_REGISTRY) expected[routeKey(entry)] = FORBIDDEN_STATUS;
  return expected;
}

describe('archived stores and suspended businesses (TEN-3, D2117)', () => {
  it('forbids every collections handler on an archived store', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.query(`UPDATE "store" SET "status" = 'archived' WHERE "id" = $1`, [a.stores[1].id]);
    await suite.kit.asOwner(a, a.stores[1]);

    // Act
    const answer = await answers();

    // Assert
    expect(answer).toEqual(everyRefusal());
  });

  it('forbids every collections handler for a suspended business', async () => {
    // Arrange
    const { b } = suite.fixtures;
    await suite.kit.query(`UPDATE "business" SET "status" = 'suspended' WHERE "id" = $1`, [b.businessId]);
    await suite.kit.asOwner(b);

    // Act
    const answer = await answers();

    // Assert
    expect(answer).toEqual(everyRefusal());
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
