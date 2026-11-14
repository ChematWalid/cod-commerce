import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { failureOf } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { PRODUCT_PERMISSIONS } from '../../api/permissions';
import { catalogSuite } from './catalog-kit';
import { OPERATION_REGISTRY, ROUTE_REGISTRY, type TargetIds } from './endpoint-registry';
import { createTaxonomy } from './taxonomy-kit';

const suite = catalogSuite(1022, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const FORBIDDEN = 'FORBIDDEN';
const FORBIDDEN_STATUS = 403;
const PRODUCT_KEYS = Object.values(PRODUCT_PERMISSIONS);

/** Every product key but the one a handler requires: a role that can do everything else. */
const allKeysBut = (access: string) => PRODUCT_KEYS.filter((key) => key !== access);

describe('catalog handlers refuse a role that lacks their key', () => {
  let ids: TargetIds;

  beforeAll(async () => {
    const { a } = suite.fixtures;
    const collectionId = await suite.kit.createCollection(a.stores[0]);
    await suite.kit.asOwner(a);
    const product = await suite.kit.createProduct({
      title: 'Guarded',
      optionGroups: [{ name: 'Size', values: ['S'] }],
    });
    const taxonomy = await createTaxonomy(suite.kit);
    ids = { productId: product.id, variantId: product.variants[0]?.id ?? '', collectionId, ...taxonomy };
  });

  it.each(OPERATION_REGISTRY.filter((entry) => entry.access !== 'catalog.products.view'))(
    '$operation is FORBIDDEN for a role holding only catalog.products.view',
    async (entry) => {
      // Arrange
      await suite.kit.signInAsMember(suite.fixtures.a, ['catalog.products.view']);

      // Act
      const failure = await failureOf(suite.kit.client.query(gql(entry.document), entry.variables(ids)));

      // Assert
      expect(failure.codes).toEqual([FORBIDDEN]);
    },
  );

  it.each(OPERATION_REGISTRY)('$operation is FORBIDDEN for a member with no role', async (entry) => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, []);

    // Act
    const failure = await failureOf(suite.kit.client.query(gql(entry.document), entry.variables(ids)));

    // Assert
    expect(failure.codes).toEqual([FORBIDDEN]);
  });

  it.each(ROUTE_REGISTRY.filter((entry) => entry.access !== 'catalog.products.view'))(
    '$method $route answers 403 for a role holding only catalog.products.view',
    async (entry) => {
      // Arrange
      await suite.kit.signInAsMember(suite.fixtures.a, ['catalog.products.view']);

      // Act
      const answer = await suite.kit.rest(entry.method, entry.url(ids), entry.body?.(ids));

      // Assert
      expect(answer.status).toBe(FORBIDDEN_STATUS);
    },
  );

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
    const answer = await suite.kit.rest(entry.method, entry.url(ids), entry.body?.(ids));

    // Assert
    expect(answer.status).toBe(FORBIDDEN_STATUS);
  });

  it.each(ROUTE_REGISTRY)(
    '$method $route answers 403 for a role holding every other catalog.products key',
    async (entry) => {
      // Arrange
      await suite.kit.signInAsMember(suite.fixtures.a, allKeysBut(entry.access));

      // Act
      const answer = await suite.kit.rest(entry.method, entry.url(ids), entry.body?.(ids));

      // Assert
      expect(answer.status).toBe(FORBIDDEN_STATUS);
    },
  );
});
