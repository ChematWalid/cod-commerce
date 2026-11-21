import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES, toBusinessId, toStoreId } from '@cod/shared';
import { failureOf, rawTestId } from '@cod/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { JOB_REPOSITORY } from '../../application/tokens';
import type { JobRepositoryPort } from '../../application/ports/job-repository.port';
import { JOB_ERROR_CODES } from '../../domain/constants';
import { BULK_EDIT_RESULT_FIELDS } from './endpoint-registry';
import { importSuite } from './import-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
/** Text a database or Vendure fault carries that no client may read (D2136). */
const LEAKS = [/activity_log/i, /relation/i, /does not exist/i, /QueryFailedError/, /\bat \w+ \(/, /select /i];
const BULK_EDIT = `mutation ($input: CatalogBulkEditInput!) { bulkEditCatalogProducts(input: $input) { ${BULK_EDIT_RESULT_FIELDS} } }`;

describe('bulk-edit faults and facade refusals reach no client as internal text (D2136)', () => {
  const breakActivity = () => suite.kit.query('ALTER TABLE "activity_log" RENAME TO "activity_log_gone"');
  const repairActivity = () => suite.kit.query('ALTER TABLE IF EXISTS "activity_log_gone" RENAME TO "activity_log"');

  afterEach(async () => {
    await repairActivity();
  });

  it('facade `catalog.*` errors map to typed codes, no stack or SQL in bodies', async () => {
    // Arrange: catalog refuses to price a pack (D2227)
    await suite.kit.asOwner(suite.fixtures.a);
    const pack = await suite.kit.createProduct({ type: 'pack', price: 0 });

    // Act
    const answer = await suite.kit.rest('POST', '/catalog/products/bulk-edit', {
      productIds: [rawTestId(pack.id)],
      changes: { price: { mode: 'fixed', value: 700 } },
    });

    // Assert
    expect(answer).toMatchObject({
      status: 200,
      body: { results: [{ ok: false, error: CATALOG_ERROR_CODES.INVALID_INPUT }] },
    });
    for (const leak of LEAKS) expect(answer.text).not.toMatch(leak);
  });

  it('answers a GraphQL fault with INTERNAL_SERVER_ERROR and no internal text', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const product = await suite.kit.createProduct();
    await breakActivity();

    // Act
    const call = () => suite.kit.gql(BULK_EDIT, { input: { productIds: [product.id], changes: { status: 'draft' } } });
    const failure = await failureOf(call());
    const raw = JSON.stringify(await call().catch((error: unknown) => error));

    // Assert
    expect(failure.codes).toEqual(['INTERNAL_SERVER_ERROR']);
    for (const leak of LEAKS) expect(raw).not.toMatch(leak);
  });

  it('answers a REST fault with a bare 500, no internal text, and the product unchanged', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const product = await suite.kit.createProduct();
    await breakActivity();

    // Act
    const answer = await suite.kit.rest('POST', '/catalog/products/bulk-edit', {
      productIds: [rawTestId(product.id)],
      changes: { status: 'draft' },
    });
    await repairActivity();

    // Assert
    expect(answer.status).toBe(500);
    for (const leak of LEAKS) expect(answer.text).not.toMatch(leak);
    expect((await suite.kit.product(product.id))?.status).toBe('active');
  });
});

describe('catalog-import faults keep internal text out of stored rows (D2136, D2210)', () => {
  it('a failed job stores only its fixed error code', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const id = await suite.kit.plantJob({
      table: 'catalog_import_job',
      businessId: a.businessId,
      storeId: a.stores[0].id,
      status: 'running',
    });
    const jobs = suite.kit.app.get<JobRepositoryPort>(JOB_REPOSITORY);
    const scope = { businessId: toBusinessId(a.businessId), storeId: toStoreId(a.stores[0].id) };

    // Act
    await jobs.markFailed(scope, { table: 'import', id }, { errorCode: JOB_ERROR_CODES.STALLED, at: new Date() });

    // Assert
    expect(await suite.kit.jobRow('catalog_import_job', id)).toEqual({
      status: 'failed',
      errorCode: JOB_ERROR_CODES.STALLED,
    });
  });

  it('a job already done is never turned failed', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const id = await suite.kit.plantJob({
      table: 'catalog_export_job',
      businessId: a.businessId,
      storeId: a.stores[0].id,
      status: 'done',
    });
    const jobs = suite.kit.app.get<JobRepositoryPort>(JOB_REPOSITORY);
    const scope = { businessId: toBusinessId(a.businessId), storeId: toStoreId(a.stores[0].id) };

    // Act
    await jobs.markFailed(scope, { table: 'export', id }, { errorCode: JOB_ERROR_CODES.STALLED, at: new Date() });

    // Assert
    expect(await suite.kit.jobRow('catalog_export_job', id)).toEqual({ status: 'done', errorCode: null });
  });
});
