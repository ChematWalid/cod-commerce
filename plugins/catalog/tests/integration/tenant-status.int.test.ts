import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { failureOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { catalogSuite, CREATE_PRODUCT, PRODUCTS } from './catalog-kit';

const suite = catalogSuite(1025, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const FORBIDDEN = 'FORBIDDEN';
const FORBIDDEN_STATUS = 403;

describe('archived stores and suspended businesses (TEN-3, D2117)', () => {
  /** Every handler kind refuses: a GraphQL read and write, a REST read and write. */
  async function refusals(): Promise<{ codes: string[]; statuses: number[] }> {
    const read = await failureOf(suite.kit.gql(PRODUCTS, {}));
    const write = await failureOf(suite.kit.gql(CREATE_PRODUCT, { input: { title: 'x', status: 'active', price: 1 } }));
    const restRead = await suite.kit.rest('GET', '/catalog/products');
    const restWrite = await suite.kit.rest('POST', '/catalog/products', { title: 'x', status: 'active', price: 1 });
    return { codes: [...read.codes, ...write.codes], statuses: [restRead.status, restWrite.status] };
  }

  it('forbids every catalog handler on an archived store', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.query(`UPDATE "store" SET "status" = 'archived' WHERE "id" = $1`, [a.stores[1].id]);
    await suite.kit.asOwner(a, a.stores[1]);

    // Act
    const answer = await refusals();

    // Assert
    expect(answer).toEqual({ codes: [FORBIDDEN, FORBIDDEN], statuses: [FORBIDDEN_STATUS, FORBIDDEN_STATUS] });
  });

  it('forbids every catalog handler for a suspended business', async () => {
    // Arrange
    const { b } = suite.fixtures;
    await suite.kit.query(`UPDATE "business" SET "status" = 'suspended' WHERE "id" = $1`, [b.businessId]);
    await suite.kit.asOwner(b);

    // Act
    const answer = await refusals();

    // Assert
    expect(answer).toEqual({ codes: [FORBIDDEN, FORBIDDEN], statuses: [FORBIDDEN_STATUS, FORBIDDEN_STATUS] });
  });

  it('serves the active store of an active business (positive control)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await suite.kit.rest('GET', '/catalog/products');

    // Assert
    expect(answer.status).toBe(200);
  });
});
