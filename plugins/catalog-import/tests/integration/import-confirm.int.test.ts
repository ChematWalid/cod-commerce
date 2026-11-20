import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  CATALOG_IMPORT_ERROR_CODES,
  toBusinessId,
  toStoreId,
} from '@cod/shared';
import { failureOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import type {
  CatalogImportPort,
  ImportActivityPort,
  ProductOriginWrites,
} from '../../application/ports/catalog-import.port';
import type { CatalogProductsPort } from '../../application/ports/catalog-products.port';
import type { ImportJobStore } from '../../application/ports/import-job.port';
import type { ImportRowStore } from '../../application/ports/import-row.port';
import type { UnitOfWorkPort } from '../../application/ports/unit-of-work.port';
import { ImportReportService } from '../../application/import-report.service';
import { RunImportJobService } from '../../application/run-import-job.service';
import {
  CATALOG_IMPORT,
  CATALOG_PRODUCTS,
  IMPORT_JOBS,
  IMPORT_ROWS,
  PRODUCT_ACTIVITY,
  PRODUCT_ORIGIN_WRITES,
  UNIT_OF_WORK,
} from '../../application/tokens';
import { jobDataOf } from '../../domain/job-kinds';
import { errorReportKey } from '../../domain/object-keys';
import { ImportsExportsJobRegistry } from '../../infrastructure/job-registry';
import { importSuite } from './import-kit';
import { csvOf, fixture, importClient, previewed } from './import-flow-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const client = importClient(suite);
const SLOW_TEST_MS = 300_000;
const ROWS = 12;
const FAIL_AFTER = 4;

const rowsOf = (prefix: string) => [
  ['product_key', 'name', 'price'],
  ...Array.from({ length: ROWS }, (_, index) => [`${prefix}-${String(index)}`, `${prefix} ${String(index)}`, '100']),
];

/** The worker's import use case, its catalog port wrapped to fault after `failAfter` creates. */
function flakyRun(failAfter: number): RunImportJobService {
  const app = suite.kit.app;
  const catalog = app.get<CatalogImportPort>(CATALOG_IMPORT);
  let creates = 0;
  const flaky: CatalogImportPort = {
    findBySkus: (...args) => catalog.findBySkus(...args),
    product: (...args) => catalog.product(...args),
    taxonomyIndex: (...args) => catalog.taxonomyIndex(...args),
    update: (...args) => catalog.update(...args),
    create: (...args) => {
      creates += 1;
      if (creates > failAfter) return Promise.reject(new Error('synthetic worker crash'));
      return catalog.create(...args);
    },
  };
  return new RunImportJobService({
    jobs: app.get<ImportJobStore>(IMPORT_JOBS),
    rows: app.get<ImportRowStore>(IMPORT_ROWS),
    catalog: flaky,
    origins: app.get<ProductOriginWrites>(PRODUCT_ORIGIN_WRITES),
    activity: app.get<ImportActivityPort>(PRODUCT_ACTIVITY),
    report: app.get(ImportReportService),
    units: app.get<UnitOfWorkPort>(UNIT_OF_WORK),
  });
}

/** A previewed import of A's first store moved to `confirming` without a queue job, so only the test runs it. */
async function confirmingWithoutQueue(prefix: string) {
  const { a } = suite.fixtures;
  await suite.kit.asOwner(a);
  const { importId } = await previewed(client, { format: 'csv', bytes: csvOf(rowsOf(prefix)) });
  const scope = { businessId: toBusinessId(a.businessId), storeId: toStoreId(a.stores[0].id) };
  const ctx = await suite.kit.app.get<CatalogProductsPort>(CATALOG_PRODUCTS).storeContext(scope);
  const [owner] = await suite.kit.query<{ id: number }>('SELECT "id" FROM administrator WHERE "emailAddress" = $1', [
    a.owner.email,
  ]);
  const by = { actorAdministratorId: owner?.id ?? 0, at: new Date() };
  await suite.kit.app.get<ImportJobStore>(IMPORT_JOBS).beginConfirm(ctx, scope, importId, by);
  return { importId, scope, ctx };
}

/** Products of the signed-in store whose title starts with `prefix`. */
async function countOf(prefix: string): Promise<number> {
  const { catalogProducts } = await suite.kit.gql<{ catalogProducts: { totalItems: number } }>(
    'query ($q: String) { catalogProducts(options: { tab: "all", q: $q }) { totalItems } }',
    { q: prefix },
  );
  return catalogProducts.totalItems;
}

describe('confirming an import (D2210, Review Focus 4 and 6)', () => {
  it(
    'progress reaches 100 and the report object exists; origin rows hold source import and the job id',
    async () => {
      // Arrange
      const { b } = suite.fixtures;
      await suite.kit.asOwner(b);
      const { importId } = await previewed(client, { format: 'csv', bytes: fixture('products-100-with-errors.csv') });

      // Act
      await client.confirm(importId);
      const done = await client.settled(importId);

      // Assert
      expect(done).toMatchObject({ status: 'done', progress: 100 });
      const scope = { businessId: toBusinessId(b.businessId), storeId: toStoreId(b.stores[0].id) };
      expect(await client.storage().head(errorReportKey(scope, importId))).not.toBeNull();
      const origins = await suite.kit.query<{ source: string; importJobId: string; storeId: string }>(
        'SELECT "source", "importJobId", "storeId" FROM catalog_product_origin WHERE "importJobId" = $1',
        [importId],
      );
      expect(origins).toHaveLength(95);
      expect(new Set(origins.map((row) => `${row.source}:${row.storeId}`))).toEqual(
        new Set([`import:${b.stores[0].id}`]),
      );
    },
    SLOW_TEST_MS,
  );

  it('an activity row records the confirmed import counts and job id', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    const { importId } = await previewed(client, { format: 'csv', bytes: csvOf(rowsOf('AUDIT')) });

    // Act
    await client.confirm(importId);
    await client.settled(importId);

    // Assert
    expect(await suite.kit.activityOf(importId)).toEqual([
      expect.objectContaining({
        businessId: a.businessId,
        storeId: a.stores[0].id,
        action: ACTIVITY_ACTIONS.CATALOG_PRODUCTS_IMPORTED,
        entityType: ACTIVITY_ENTITY_TYPES.CATALOG_JOB,
        diff: { created: ROWS, updated: 0, failed: 0 },
      }),
    ]);
  });

  it("a create-only member cannot confirm an owner's preview that contains updates", async () => {
    // Arrange: the owner previews an update of an existing product
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    await suite.kit.createProduct({ title: 'Owner product', sku: 'OWN-1' });
    const { importId } = await previewed(client, {
      format: 'csv',
      bytes: csvOf([
        ['product_key', 'name', 'price'],
        ['OWN-1', 'Owner product', '5'],
      ]),
    });
    await suite.kit.signInAsMember(a, ['catalog.products.view', 'catalog.products.create']);

    // Act
    const failure = await failureOf(client.confirm(importId));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
    expect((await client.status(importId)).status).toBe('previewed');
  });

  it('two concurrent confirms: exactly one job runs, the other answers 409 job-state', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { importId } = await previewed(client, { format: 'csv', bytes: csvOf(rowsOf('TWICE')) });
    const path = `/catalog/import-export/products/imports/${importId}/confirm`;

    // Act
    const answers = await Promise.all([suite.kit.rest('POST', path), suite.kit.rest('POST', path)]);
    await client.settled(importId);

    // Assert
    expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409]);
    expect(answers.find((answer) => answer.status === 409)?.body).toMatchObject({
      code: CATALOG_IMPORT_ERROR_CODES.JOB_STATE,
    });
    expect(await countOf('TWICE')).toBe(ROWS);
  });

  it('a re-PUT of the file after the preview (ETag changed) refuses the confirm', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { importId, key } = await client.upload({ format: 'csv', bytes: csvOf(rowsOf('REPUT')) });
    await client.analyze(importId);
    await client.preview(importId);
    await client.storage().write(key, csvOf(rowsOf('SWAPPED')), 'text/csv');

    // Act
    const failure = await failureOf(client.confirm(importId));

    // Assert
    expect(failure.codes).toEqual([CATALOG_IMPORT_ERROR_CODES.JOB_STATE]);
    expect(await countOf('SWAPPED')).toBe(0);
  });

  it(
    'a retried confirm job creates no duplicate; re-running a half-applied job creates no duplicates',
    async () => {
      // Arrange: a worker that crashes after 4 products, twice (BullMQ's retry finds the row half applied)
      const { importId, scope, ctx } = await confirmingWithoutQueue('RETRY');
      await expect(flakyRun(FAIL_AFTER).run(ctx, scope, importId)).rejects.toThrow('synthetic worker crash');
      const afterCrash = await countOf('RETRY');
      await expect(flakyRun(FAIL_AFTER).run(ctx, scope, importId)).rejects.toThrow('synthetic worker crash');
      const afterRetry = await countOf('RETRY');

      // Act: the reconciler's re-enqueue of the still-running row, through the real worker
      const data = jobDataOf({ table: 'import', id: importId, ...scope });
      await suite.kit.app.get(ImportsExportsJobRegistry).run(data, { attempts: 1, retries: 1 });

      // Assert
      expect([afterCrash, afterRetry]).toEqual([FAIL_AFTER, FAIL_AFTER * 2]);
      expect(await countOf('RETRY')).toBe(ROWS);
      expect((await client.status(importId)).result).toEqual({ created: ROWS, updated: 0, failed: 0 });
    },
    SLOW_TEST_MS,
  );
});
