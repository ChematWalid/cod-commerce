import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { RateLimiter } from '@cod/plugin-rate-limit';
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITY_TYPES, CATALOG_IMPORT_ERROR_CODES } from '@cod/shared';
import { failureOf, rawTestId } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { csvText, exportClient, keyOfLink, signedParamsOf } from './export-kit';
import { importSuite } from './import-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const { exportProducts, status, fileOf, settled } = exportClient(suite);
const BUSINESS_BUDGET = 120;
const JOB_PRODUCTS = 601;
const SEED_BATCH = 20;
const SLOW_TEST_MS = 600_000;
const UTF8_BOM = [0xef, 0xbb, 0xbf];

/** As A's owner on `storeIndex`, products titled `<prefix> <n>` (active, priced 1 000), in id order. */
async function productsOfA(prefix: string, count: number, storeIndex: 0 | 1 = 0): Promise<string[]> {
  const { a } = suite.fixtures;
  await suite.kit.asOwner(a, a.stores[storeIndex]);
  const ids: string[] = [];
  for (let start = 0; start < count; start += SEED_BATCH) {
    const batch = Array.from({ length: Math.min(SEED_BATCH, count - start) }, (_, index) =>
      suite.kit.createProduct({ title: `${prefix} ${String(start + index + 1)}` }),
    );
    for (const product of await Promise.all(batch)) ids.push(product.id);
  }
  return ids;
}

/** The data lines of a CSV export (the header first). */
const linesOf = (bytes: Uint8Array): string[] =>
  csvText(bytes)
    .split('\r\n')
    .filter((line) => line !== '');

describe('product export (AC3, D2211)', () => {
  it('exports 3 selected products to CSV synchronously; the presigned GET is issued for the exports/ key with attachment disposition', async () => {
    // Arrange
    const ids = await productsOfA('Selected sync', 3);

    // Act
    const started = await exportProducts({ scope: 'selected', format: 'csv', productIds: ids });

    // Assert
    expect(started).toMatchObject({ status: 'done', rowCount: 3, progress: 100, errorCode: null });
    const link = started.downloadUrl ?? '';
    expect(signedParamsOf(link).get('disposition')).toBe(`attachment; filename="products-${started.exportId}.csv"`);
    expect(signedParamsOf(link).get('type')).toBe('text/csv');
    const bytes = await fileOf(link);
    expect([...bytes.subarray(0, UTF8_BOM.length)]).toEqual(UTF8_BOM);
    const lines = linesOf(bytes);
    expect(lines[0]?.startsWith('product_key,name,description,status,type,price')).toBe(true);
    expect(lines.slice(1).map((line) => line.split(',')[1])).toEqual([
      'Selected sync 1',
      'Selected sync 2',
      'Selected sync 3',
    ]);
  });

  it('the file key starts with exports/b/<A>/s/<store>/', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const ids = await productsOfA('Keyed', 1);

    // Act
    const started = await exportProducts({ scope: 'selected', format: 'xlsx', productIds: ids });

    // Assert
    expect(keyOfLink(started.downloadUrl ?? '')).toBe(
      `exports/b/${a.businessId}/s/${a.stores[0].id}/exports/${started.exportId}/file`,
    );
    expect(signedParamsOf(started.downloadUrl ?? '').get('disposition')).toBe(
      `attachment; filename="products-${started.exportId}.xlsx"`,
    );
  });

  it('filtered scope uses the list query', async () => {
    // Arrange
    await productsOfA('Quartzfilter', 2);
    await productsOfA('Unrelated item', 1);

    // Act
    const started = await exportProducts({ scope: 'filtered', format: 'csv', query: { q: 'Quartzfilter' } });

    // Assert
    expect(started).toMatchObject({ status: 'done', rowCount: 2 });
    const names = linesOf(await fileOf(started.downloadUrl ?? ''))
      .slice(1)
      .map((line) => line.split(',')[1]);
    expect(names).toEqual(['Quartzfilter 1', 'Quartzfilter 2']);
  });

  it('selected ids are deduped', async () => {
    // Arrange
    const [id] = await productsOfA('Deduped', 1);
    if (id === undefined) throw new Error('no product');

    // Act
    const started = await exportProducts({ scope: 'selected', format: 'csv', productIds: [id, id, id] });

    // Assert
    expect(started.rowCount).toBe(1);
  });

  it('a pack product is skipped and counted (D2220)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const pack = await suite.kit.createProduct({ type: 'pack', price: 0, title: 'Synthetic pack' });
    const [physical] = await productsOfA('Beside a pack', 1);

    // Act
    const started = await exportProducts({ scope: 'selected', format: 'csv', productIds: [pack.id, physical] });

    // Assert
    expect(started).toMatchObject({ status: 'done', rowCount: 1, skippedPacks: 1 });
    expect(csvText(await fileOf(started.downloadUrl ?? ''))).not.toContain('Synthetic pack');
  });

  it(
    '601 products run as a job and finish with a file',
    async () => {
      // Arrange: A's second store holds exactly these products
      await productsOfA('Job export', JOB_PRODUCTS, 1);

      // Act
      const started = await exportProducts({ scope: 'filtered', format: 'csv', query: { tab: 'all' } });
      const finished = await settled(started.exportId);

      // Assert
      expect(started).toMatchObject({ status: 'queued', downloadUrl: null });
      expect(finished).toMatchObject({ status: 'done', rowCount: JOB_PRODUCTS, progress: 100, errorCode: null });
      const { a } = suite.fixtures;
      expect(keyOfLink(finished.downloadUrl ?? '')).toBe(
        `exports/b/${a.businessId}/s/${a.stores[1].id}/exports/${started.exportId}/file`,
      );
      expect(linesOf(await fileOf(finished.downloadUrl ?? ''))).toHaveLength(JOB_PRODUCTS + 1);
      expect(await suite.kit.activityOf(started.exportId)).toEqual([
        expect.objectContaining({
          diff: { scope: 'filtered', format: 'csv', rowCount: JOB_PRODUCTS, skippedPacks: 0 },
        }),
      ]);
    },
    SLOW_TEST_MS,
  );

  it('an activity row records the export scope and row count', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const ids = await productsOfA('Audited', 2);

    // Act
    const started = await exportProducts({ scope: 'selected', format: 'xlsx', productIds: ids });

    // Assert
    expect(await suite.kit.activityOf(started.exportId)).toEqual([
      expect.objectContaining({
        businessId: a.businessId,
        storeId: a.stores[0].id,
        action: ACTIVITY_ACTIONS.CATALOG_PRODUCTS_EXPORTED,
        entityType: ACTIVITY_ENTITY_TYPES.CATALOG_JOB,
        diff: { scope: 'selected', format: 'xlsx', rowCount: 2, skippedPacks: 0 },
      }),
    ]);
  });

  it("business B reading A's export id gets not found", async () => {
    // Arrange
    const ids = await productsOfA('Private to A', 1);
    const started = await exportProducts({ scope: 'selected', format: 'csv', productIds: ids });
    await suite.kit.asOwner(suite.fixtures.b);

    // Act
    const failure = await failureOf(status(started.exportId));
    const rest = await suite.kit.rest('GET', `/catalog/import-export/exports/${started.exportId}`);

    // Assert
    expect(failure.codes).toEqual([CATALOG_IMPORT_ERROR_CODES.JOB_NOT_FOUND]);
    expect(rest).toMatchObject({ status: 404, body: { code: CATALOG_IMPORT_ERROR_CODES.JOB_NOT_FOUND } });
    expect(rest.text).not.toContain('memory://');
  });

  it("A's export naming B's product writes a file without it (rowCount 0)", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);
    const ofB = await suite.kit.createProduct({ title: 'Synthetic product of B' });
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const started = await exportProducts({ scope: 'selected', format: 'csv', productIds: [ofB.id] });

    // Assert
    expect(started).toMatchObject({ status: 'done', rowCount: 0 });
    expect(csvText(await fileOf(started.downloadUrl ?? ''))).not.toContain('Synthetic product of B');
  });

  it('view permission suffices; no permission → FORBIDDEN', async () => {
    // Arrange
    const ids = await productsOfA('Viewed', 1);

    // Act
    await suite.kit.signInAsMember(suite.fixtures.a, ['catalog.products.view']);
    const allowed = await exportProducts({ scope: 'selected', format: 'csv', productIds: ids });
    await suite.kit.signInAsMember(suite.fixtures.a, []);
    const refused = await failureOf(exportProducts({ scope: 'selected', format: 'csv', productIds: ids }));

    // Assert
    expect(allowed).toMatchObject({ status: 'done', rowCount: 1 });
    expect(refused.codes).toEqual(['FORBIDDEN']);
  });

  it('a malformed input answers catalog-import.invalid-input over both surfaces', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const failure = await failureOf(exportProducts({ scope: 'selected', format: 'csv', productIds: [] }));
    const rest = await suite.kit.rest('POST', '/catalog/products/export', { scope: 'everything', format: 'csv' });

    // Assert
    expect(failure.codes).toEqual([CATALOG_IMPORT_ERROR_CODES.INVALID_INPUT]);
    expect(rest).toMatchObject({ status: 400, body: { code: CATALOG_IMPORT_ERROR_CODES.INVALID_INPUT } });
  });

  it('export 429 after the business budget, with Retry-After', async () => {
    // Arrange: B's export budget spent to the last call
    const { b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const product = await suite.kit.createProduct();
    const limiter = suite.kit.app.get(RateLimiter);
    for (let spent = 0; spent < BUSINESS_BUDGET; spent += 1) {
      await limiter.consume('catalog-export-business', b.businessId);
    }

    // Act
    const body = { scope: 'selected', format: 'csv', productIds: [rawTestId(product.id)] };
    const answer = await suite.kit.restRaw(
      'POST',
      '/catalog/products/export',
      new TextEncoder().encode(JSON.stringify(body)),
    );

    // Assert
    expect(answer.status).toBe(429);
    expect(Number(answer.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
