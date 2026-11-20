import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import {
  CATALOG_IMPORT_ERROR_CODES,
  CATALOG_IMPORT_ROW_ERRORS,
  IMPORT_MAX_ROWS,
  IMPORT_PREVIEW_PAGE_MAX,
} from '@cod/shared';
import { failureOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { XLSX_ENTRIES, zipOf } from '../support/zip-builder';
import { importSuite } from './import-kit';
import { csvOf, fixture, importClient, previewed, productCount } from './import-flow-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const client = importClient(suite);
const C = CATALOG_IMPORT_ERROR_CODES;
const E = CATALOG_IMPORT_ROW_ERRORS;
const FIXTURE_ROWS = 100;
const SLOW_TEST_MS = 300_000;
const HEADER = ['product_key', 'name', 'price', 'type', 'variant_sku'];

describe('spreadsheet import flow (AC2, D2208-D2210)', () => {
  it(
    '100-row CSV fixture previews 100 creates; confirm creates exactly them',
    async () => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);
      const before = await productCount(suite);

      // Act
      const { importId, preview } = await previewed(client, { format: 'csv', bytes: fixture('products-100.csv') });
      await client.confirm(importId);
      const done = await client.settled(importId);

      // Assert
      expect(preview.summary).toEqual({ creates: FIXTURE_ROWS, updates: 0, errors: 0, warnings: 0 });
      expect(done).toMatchObject({
        status: 'done',
        progress: 100,
        result: { created: FIXTURE_ROWS, updated: 0, failed: 0 },
      });
      expect(await productCount(suite)).toBe(before + FIXTURE_ROWS);
    },
    SLOW_TEST_MS,
  );

  it(
    're-import of the same file previews 100 updates and creates nothing',
    async () => {
      // Arrange: the CSV fixture was imported into A's first store by the test above
      await suite.kit.asOwner(suite.fixtures.a);
      const before = await productCount(suite);

      // Act
      const { importId, preview } = await previewed(client, { format: 'csv', bytes: fixture('products-100.csv') });
      await client.confirm(importId);
      const done = await client.settled(importId);

      // Assert
      expect(preview.summary).toEqual({ creates: 0, updates: FIXTURE_ROWS, errors: 0, warnings: 0 });
      expect(done.result).toEqual({ created: 0, updated: FIXTURE_ROWS, failed: 0 });
      expect(await productCount(suite)).toBe(before);
    },
    SLOW_TEST_MS,
  );

  it('image_urls stored on the origin row', async () => {
    // Arrange: FX-010 carries one image link in the fixture
    const [origin] = await suite.kit.query<{ source: string; imageUrls: string[] }>(
      `SELECT "source", "imageUrls" FROM catalog_product_origin WHERE "imageUrls" @> $1::jsonb`,
      [JSON.stringify(['https://img.example.com/fx-010.jpg'])],
    );

    // Assert
    expect(origin).toEqual({ source: 'import', imageUrls: ['https://img.example.com/fx-010.jpg'] });
  });

  it(
    '100-row xlsx fixture previews 100 creates',
    async () => {
      // Arrange: A's second store holds none of the fixture's SKUs
      await suite.kit.asOwner(suite.fixtures.a, suite.fixtures.a.stores[1]);

      // Act
      const { preview } = await previewed(client, { format: 'xlsx', bytes: fixture('products-100.xlsx') });

      // Assert
      expect(preview.summary).toEqual({ creates: FIXTURE_ROWS, updates: 0, errors: 0, warnings: 0 });
      expect(preview.items[0]).toMatchObject({ rowNumber: 2, action: 'create', productKey: 'FX-001' });
    },
    SLOW_TEST_MS,
  );

  it('mixed fixture (seeded SKUs + new + bad rows) previews N create / M update / K error with row numbers', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await suite.kit.createProduct({ title: 'Seeded 1', sku: 'MIX-1' });
    await suite.kit.createProduct({ title: 'Seeded 2', sku: 'MIX-2' });
    const bytes = csvOf([
      HEADER,
      ['MIX-1', 'Seeded 1', '1100', '', 'MIX-1'],
      ['MIX-NEW-1', 'New 1', '900', '', ''],
      ['MIX-2', 'Seeded 2', '1200', '', 'MIX-2'],
      ['MIX-NEW-2', 'New 2', '-5', '', ''],
      ['MIX-NEW-3', 'New 3', '800', 'pack', ''],
      ['MIX-NEW-4', 'New 4', '700', '', ''],
    ]);

    // Act
    const { preview } = await previewed(client, { format: 'csv', bytes });

    // Assert
    expect(preview.summary).toEqual({ creates: 2, updates: 2, errors: 2, warnings: 0 });
    expect(preview.items.filter((row) => row.action === 'error')).toEqual([
      expect.objectContaining({ rowNumber: 5, messages: [E.INVALID_VALUE] }),
      expect.objectContaining({ rowNumber: 6, messages: [E.TYPE_UNSUPPORTED] }),
    ]);
  });

  it('explicit variant SKUs and prices from the file survive create', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const header = ['product_key', 'name', 'price', 'option1_name', 'option1_value', 'variant_sku'];
    const bytes = csvOf([
      header,
      ['TEE', 'Tee', '1500', 'Size', 'S', 'TEE-SMALL'],
      ['TEE', 'Tee', '1700', 'Size', 'M', 'TEE-MED'],
    ]);

    // Act
    const { importId } = await previewed(client, { format: 'csv', bytes });
    await client.confirm(importId);
    await client.settled(importId);
    const { catalogProducts } = await suite.kit.gql<{ catalogProducts: { items: { id: string }[] } }>(
      'query { catalogProducts(options: { q: "TEE-SMALL" }) { items { id } } }',
    );
    const { catalogProduct } = await suite.kit.gql<{ catalogProduct: { variants: { sku: string; price: number }[] } }>(
      'query ($id: ID!) { catalogProduct(id: $id) { variants { sku price } } }',
      { id: catalogProducts.items[0]?.id },
    );

    // Assert
    expect(catalogProduct.variants).toEqual(
      expect.arrayContaining([
        { sku: 'TEE-SMALL', price: 1500 },
        { sku: 'TEE-MED', price: 1700 },
      ]),
    );
  });

  it(
    'fixture with errors lists row numbers and reasons and confirm skips them',
    async () => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.b);

      // Act
      const { importId, preview } = await previewed(client, {
        format: 'csv',
        bytes: fixture('products-100-with-errors.csv'),
      });
      await client.confirm(importId);
      const done = await client.settled(importId);

      // Assert
      expect(preview.items.filter((row) => row.action === 'error').map((row) => [row.rowNumber, row.messages])).toEqual(
        [
          [6, [E.INVALID_VALUE]],
          [18, [E.INVALID_VALUE]],
          [34, [E.IMAGE_URL]],
          [62, [E.INVALID_VALUE]],
          [89, [E.INVALID_VALUE]],
        ],
      );
      expect(done.result).toEqual({ created: 95, updated: 0, failed: 5 });
      expect(done.errorReportUrl).toMatch(/^memory:\/\/exports\//);
    },
    SLOW_TEST_MS,
  );

  it('preview pages hold at most 200 rows', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b, suite.fixtures.b.stores[1]);
    const rows = Array.from({ length: 250 }, (_, index) => [`PG-${String(index)}`, `Paged ${String(index)}`, '100']);
    const { importId, preview } = await previewed(client, {
      format: 'csv',
      bytes: csvOf([['product_key', 'name', 'price'], ...rows]),
    });

    // Act
    const second = await client.page(importId, IMPORT_PREVIEW_PAGE_MAX, IMPORT_PREVIEW_PAGE_MAX);
    const tooLarge = await failureOf(client.page(importId, 0, IMPORT_PREVIEW_PAGE_MAX + 1));

    // Assert
    expect(preview).toMatchObject({ totalItems: 250 });
    expect(preview.items).toHaveLength(IMPORT_PREVIEW_PAGE_MAX);
    expect(second.items).toHaveLength(50);
    expect(tooLarge.codes).toEqual([C.INVALID_INPUT]);
  });

  it('5 001 rows → too-many-rows', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);
    const rows = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, index) => [`R${String(index)}`, '1']);
    const { importId } = await client.upload({ format: 'csv', bytes: csvOf([['name', 'price'], ...rows]) });

    // Act and Assert
    expect((await failureOf(client.analyze(importId))).codes).toEqual([C.TOO_MANY_ROWS]);
  });

  it.each([
    [
      'HTML named xlsx → file-type',
      { format: 'xlsx', bytes: new TextEncoder().encode('<html><body>x</body></html>') },
      C.FILE_TYPE,
    ],
    [
      'an object larger than declared → file-too-large',
      { format: 'csv', bytes: csvOf([['name', 'price']]), declaredSize: 5 },
      C.FILE_TOO_LARGE,
    ],
    [
      'a content type other than declared → file-type',
      { format: 'csv', bytes: csvOf([['name', 'price']]), putContentType: 'text/html' },
      C.FILE_TYPE,
    ],
    [
      'a deflate-bomb xlsx → file-type',
      {
        format: 'xlsx',
        bytes: zipOf([
          ...XLSX_ENTRIES.slice(0, 2),
          { name: 'xl/worksheets/sheet1.xml', compressed: 400, uncompressed: 4_000_000_000 },
        ]),
      },
      C.FILE_TYPE,
    ],
  ] as const)('%s, the object is deleted and nothing is written', async (_name, spec, code) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);
    const before = await productCount(suite);
    const { importId, key } = await client.upload(spec);

    // Act
    const failure = await failureOf(client.analyze(importId));

    // Assert
    expect(failure.codes).toEqual([code]);
    expect(await client.storage().head(key)).toBeNull();
    expect((await client.status(importId)).status).toBe('awaiting_upload');
    expect(await productCount(suite)).toBe(before);
  });
});
