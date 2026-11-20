import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { RateLimiter } from '@cod/plugin-rate-limit';
import { CATALOG_IMPORT_ROW_ERRORS } from '@cod/shared';
import { failureOf } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { OPERATION_REGISTRY, ROUTE_REGISTRY, type TargetIds } from './endpoint-registry';
import { importSuite } from './import-kit';
import { csvOf, importClient, previewed } from './import-flow-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const client = importClient(suite);
const E = CATALOG_IMPORT_ROW_ERRORS;
const ACTOR_BUDGET = 30;
const CREATE = 'catalog.products.create';
const IMPORT_STEPS = [
  'createCatalogImportUpload',
  'analyzeCatalogImport',
  'catalogImport',
  'catalogImportPreview',
  'previewCatalogImport',
  'confirmCatalogImport',
];
const THROTTLED_ROUTES = [
  'POST /catalog/import-export/uploads',
  'POST /catalog/import-export/products/analyze',
  'POST /catalog/import-export/products/imports/:id/preview',
  'POST /catalog/import-export/products/imports/:id/confirm',
];

describe('spreadsheet import access (D2207, D2217)', () => {
  let ids: TargetIds;

  beforeAll(async () => {
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    const product = await suite.kit.createProduct({ title: 'Held by A', sku: 'ACC-1' });
    const { importId } = await client.upload({ format: 'csv', bytes: csvOf([['name', 'price']]) });
    ids = { productId: product.id, importId, exportId: importId, linkImportId: importId };
  });

  it('a create-only member previews update rows as catalog-import.update-forbidden errors and confirm skips them', async () => {
    // Arrange
    await suite.kit.signInAsMember(suite.fixtures.a, ['catalog.products.view', CREATE]);
    const bytes = csvOf([
      ['product_key', 'name', 'price'],
      ['ACC-1', 'Held by A', '1'],
      ['ACC-NEW', 'New for A', '1'],
    ]);

    // Act
    const { importId, preview } = await previewed(client, { format: 'csv', bytes });
    const confirmed = await client.confirm(importId);
    const done = await client.settled(importId);

    // Assert
    expect(preview.items.map((row) => [row.action, row.messages])).toEqual([
      ['error', [E.UPDATE_FORBIDDEN]],
      ['create', []],
    ]);
    expect(confirmed.status).toBe('confirming');
    expect(done.result).toEqual({ created: 1, updated: 0, failed: 1 });
  });

  it.each(OPERATION_REGISTRY.filter((entry) => IMPORT_STEPS.includes(entry.operation)))(
    'no create permission → FORBIDDEN on $operation',
    async (entry) => {
      // Arrange
      await suite.kit.signInAsMember(suite.fixtures.a, ['catalog.products.view', 'catalog.products.edit']);

      // Act
      const failure = await failureOf(suite.kit.client.query(gql(entry.document), entry.variables(ids)));

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    },
  );

  it.each(ROUTE_REGISTRY.filter((entry) => THROTTLED_ROUTES.includes(`${entry.method} ${entry.route}`)))(
    '$method $route answers 429 after the actor budget, with Retry-After',
    async (entry) => {
      // Arrange: B's owner has spent the whole actor budget
      const { b } = suite.fixtures;
      await suite.kit.asOwner(b);
      const [owner] = await suite.kit.query<{ userId: number }>(
        'SELECT "userId" FROM administrator WHERE "emailAddress" = $1',
        [b.owner.email],
      );
      const limiter = suite.kit.app.get(RateLimiter);
      for (let spent = 0; spent < ACTOR_BUDGET; spent += 1) {
        await limiter.consume('catalog-import-actor', `${b.businessId}:${String(owner?.userId)}`);
      }

      // Act
      const body = new TextEncoder().encode(JSON.stringify(entry.body?.(ids) ?? {}));
      const answer = await suite.kit.restRaw('POST', entry.url(ids), body);

      // Assert
      expect(answer.status).toBe(429);
      expect(Number(answer.headers.get('retry-after'))).toBeGreaterThan(0);
    },
  );
});
