import {
  CATALOG_IMPORT_OBJECT_STORAGE,
  CatalogImportPlugin,
  type CatalogImportObjectStorage,
} from '@cod/plugin-catalog-import';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { describe, expect, it } from 'vitest';
import { outboxSettled, PACK, type PackResult, packInput, packsSuite, SAVE_PACK, until } from './packs-kit';

/**
 * Fewer connections than the `integrations` queue runs recompute deliveries at once (5): a delivery that asks the
 * pool for a second connection while its own transaction holds one deadlocks the pool here (#260, D2282).
 */
const POOL_SIZE = 4;
const NEW_ROWS = 519;
const IMPORT_DEADLINE_MS = 300_000;
const SLOW_TEST_MS = 420_000;
const MEMORY_SCHEME = 'memory://';
const CSV_CONTENT_TYPE = 'text/csv';
const HEADER = ['product_key', 'name', 'price', 'type', 'variant_sku'];

const suite = packsSuite({
  plugins: [RbacPlugin],
  partitionedSchemas: [ACTIVITY_LOG_SCHEMA],
  trailing: [CatalogImportPlugin.init({ objectStorage: { kind: 'memory' }, linkScraper: 'fixture', appEnv: 'test' })],
  poolSize: POOL_SIZE,
});

const UPLOAD = `mutation ($input: CatalogImportUploadInput!) {
  createCatalogImportUpload(input: $input) { importId uploadUrl }
}`;
const ANALYZE = `mutation ($input: CatalogImportAnalyzeInput!) { analyzeCatalogImport(input: $input) { importId status } }`;
const PREVIEW = `mutation ($id: String!) {
  previewCatalogImport(id: $id) { summary { creates updates errors warnings } }
}`;
const CONFIRM = `mutation ($id: String!) { confirmCatalogImport(id: $id) { importId status } }`;
const STATUS = `query ($id: String!) {
  catalogImport(id: $id) { status errorCode result { created updated failed } }
}`;

interface ImportStatus {
  readonly status: string;
  readonly errorCode: string | null;
  readonly result: { created: number; updated: number; failed: number } | null;
}

/** A 520-row CSV: one update of the pack's component `BIG-SHIRT` to 2 500, then 519 new products. */
function largeCsv(): Uint8Array {
  const rows = [
    HEADER,
    ['BIG-SHIRT', 'Shirt', '2500', '', 'BIG-SHIRT'],
    ...Array.from({ length: NEW_ROWS }, (_unused, index) => {
      const key = `BIG-NEW-${String(index + 1).padStart(3, '0')}`;
      return [key, `Synthetic ${key}`, '900', '', ''];
    }),
  ];
  return new TextEncoder().encode(rows.map((row) => row.join(',')).join('\r\n'));
}

/** Uploads, analyzes, previews and confirms `bytes` as the signed-in owner; answers the import id. */
async function confirmedImport(bytes: Uint8Array): Promise<{ importId: string; summary: unknown }> {
  const input = { format: 'csv', size: bytes.length, contentType: CSV_CONTENT_TYPE };
  const { createCatalogImportUpload: started } = await suite.kit.gql<{
    createCatalogImportUpload: { importId: string; uploadUrl: string };
  }>(UPLOAD, { input });
  const key = decodeURIComponent(started.uploadUrl.slice(MEMORY_SCHEME.length).split('?')[0] ?? '');
  const storage = suite.kit.app.get<CatalogImportObjectStorage>(CATALOG_IMPORT_OBJECT_STORAGE);
  await storage.write(key as Parameters<CatalogImportObjectStorage['write']>[0], bytes, CSV_CONTENT_TYPE);
  await suite.kit.gql(ANALYZE, { input: { importId: started.importId } });
  const { previewCatalogImport } = await suite.kit.gql<{ previewCatalogImport: { summary: unknown } }>(PREVIEW, {
    id: started.importId,
  });
  await suite.kit.gql(CONFIRM, { id: started.importId });
  return { importId: started.importId, summary: previewCatalogImport.summary };
}

describe('a large spreadsheet import with a pack present (#260, D2282)', () => {
  it(
    'imports 520 rows on a pool smaller than the recompute concurrency, and the pack follows its component',
    async () => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);
      const shirt = await suite.kit.createProduct({ title: 'Shirt', price: 1500, sku: 'BIG-SHIRT' });
      const trousers = await suite.kit.createProduct({ title: 'Trousers', price: 2000, sku: 'BIG-TROUSERS' });
      const pack = await suite.kit.createPackProduct();
      await suite.kit.gql(SAVE_PACK, { id: pack.id, input: packInput([shirt.id, trousers.id]) });
      await outboxSettled(suite.kit);

      // Act
      const { importId, summary } = await confirmedImport(largeCsv());
      const finished = await until(async () => {
        const { catalogImport } = await suite.kit.gql<{ catalogImport: ImportStatus }>(STATUS, { id: importId });
        return catalogImport.status === 'done' || catalogImport.status === 'failed' ? catalogImport : undefined;
      }, IMPORT_DEADLINE_MS);
      await outboxSettled(suite.kit, IMPORT_DEADLINE_MS);

      // Assert
      expect(summary).toEqual({ creates: NEW_ROWS, updates: 1, errors: 0, warnings: 0 });
      expect(finished).toEqual({
        status: 'done',
        errorCode: null,
        result: { created: NEW_ROWS, updated: 1, failed: 0 },
      });
      const { catalogPack } = await suite.kit.gql<{ catalogPack: PackResult }>(PACK, { id: pack.id });
      expect(catalogPack).toMatchObject({ status: 'ok', price: 4050 });
      const failed = await suite.kit.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM outbox_delivery
         WHERE consumer = 'catalog-packs-recompute' AND status IN ('failed', 'parked')`,
      );
      expect(failed).toEqual([{ count: '0' }]);
    },
    SLOW_TEST_MS,
  );
});
