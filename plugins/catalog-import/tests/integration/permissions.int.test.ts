import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { failureOf } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { OPERATION_REGISTRY, ROUTE_REGISTRY, type TargetIds } from './endpoint-registry';
import { importSuite } from './import-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
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

describe('catalog-import handlers refuse a role that lacks their key', () => {
  let ids: TargetIds;

  beforeAll(async () => {
    const { a } = suite.fixtures;
    const store = a.stores[0].id;
    await suite.kit.asOwner(a);
    const product = await suite.kit.createProduct();
    ids = {
      productId: product.id,
      importId: await suite.kit.plantJob({
        table: 'catalog_import_job',
        businessId: a.businessId,
        storeId: store,
        status: 'previewed',
      }),
      exportId: await suite.kit.plantJob({
        table: 'catalog_export_job',
        businessId: a.businessId,
        storeId: store,
        status: 'done',
      }),
      linkImportId: await suite.kit.plantJob({
        table: 'catalog_import_job',
        kind: 'link',
        businessId: a.businessId,
        storeId: store,
        status: 'done',
      }),
    };
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
