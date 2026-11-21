import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { failureOf, rawTestId } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { OPERATION_REGISTRY, ROUTE_REGISTRY, type TargetIds } from './endpoint-registry';
import { packInput, packsSuite, SAVE_PACK } from './packs-kit';

const suite = packsSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const FORBIDDEN = 'FORBIDDEN';
const FORBIDDEN_STATUS = 403;
const PRODUCT_KEYS = [
  'catalog.products.view',
  'catalog.products.create',
  'catalog.products.edit',
  'catalog.products.delete',
] as const;

/** Every product key but the one a handler requires: a role that can do everything else. */
const allKeysBut = (access: string) => PRODUCT_KEYS.filter((key) => key !== access);

describe('pack handlers refuse a role that lacks their key', () => {
  let ids: TargetIds;
  let restIds: TargetIds;

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.a);
    const one = await suite.kit.createProduct({ title: 'One', price: 10 });
    const two = await suite.kit.createProduct({ title: 'Two', price: 20 });
    const pack = await suite.kit.createPackProduct();
    await suite.kit.gql(SAVE_PACK, { id: pack.id, input: packInput([one.id, two.id]) });
    ids = { productId: pack.id, componentId: one.id, otherComponentId: two.id };
    restIds = { productId: rawTestId(pack.id), componentId: rawTestId(one.id), otherComponentId: rawTestId(two.id) };
  });

  it.each(OPERATION_REGISTRY)('$operation is FORBIDDEN for a member with no role', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, []);

    // Act
    const failure = await failureOf(suite.kit.client.query(gql(entry.document), entry.variables(ids)));

    // Assert
    expect(failure.codes).toEqual([FORBIDDEN]);
  });

  it.each(OPERATION_REGISTRY)(
    '$operation is FORBIDDEN for a role holding every other catalog.products key',
    async (entry) => {
      // Arrange
      await suite.kit.signInAsMember(suite.fixtures.a, allKeysBut(entry.access));

      // Act
      const failure = await failureOf(suite.kit.client.query(gql(entry.document), entry.variables(ids)));

      // Assert
      expect(failure.codes).toEqual([FORBIDDEN]);
    },
  );

  it.each(ROUTE_REGISTRY)('$method $route answers 403 for a member with no role', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, []);

    // Act
    const answer = await suite.kit.rest(entry.method, entry.url(restIds), entry.body?.(restIds));

    // Assert
    expect(answer.status).toBe(FORBIDDEN_STATUS);
  });

  it.each(ROUTE_REGISTRY)(
    '$method $route answers 403 for a role holding every other catalog.products key',
    async (entry) => {
      // Arrange
      await suite.kit.signInAsMember(suite.fixtures.a, allKeysBut(entry.access));

      // Act
      const answer = await suite.kit.rest(entry.method, entry.url(restIds), entry.body?.(restIds));

      // Assert
      expect(answer.status).toBe(FORBIDDEN_STATUS);
    },
  );

  it.each(OPERATION_REGISTRY)(
    '$operation succeeds for a member holding only its key (positive control)',
    async (entry) => {
      // Arrange
      await suite.kit.signInAsMember(suite.fixtures.a, [entry.access]);

      // Act
      const data = await suite.kit.client.query<Record<string, unknown>>(gql(entry.document), entry.variables(ids));

      // Assert
      expect(data[entry.operation]).not.toBeNull();
    },
  );
});
