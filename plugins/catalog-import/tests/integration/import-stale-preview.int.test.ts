import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_IMPORT_ROW_ERRORS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { importSuite } from './import-kit';
import { csvOf, importClient, previewed } from './import-flow-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const client = importClient(suite);
const ROWS = 6;

const rowsOf = (prefix: string) => [
  ['product_key', 'name', 'price'],
  ...Array.from({ length: ROWS }, (_, index) => [`${prefix}-${String(index)}`, `${prefix} ${String(index)}`, '100']),
];

/** Products of the signed-in store whose title holds `prefix`. */
async function countOf(prefix: string): Promise<number> {
  const { catalogProducts } = await suite.kit.gql<{ catalogProducts: { totalItems: number } }>(
    'query ($q: String) { catalogProducts(options: { tab: "all", q: $q }) { totalItems } }',
    { q: prefix },
  );
  return catalogProducts.totalItems;
}

describe('confirm applies exactly what the preview showed (AC2)', () => {
  it("a row naming an existing pack's SKU previews as row-type-unsupported, not an update (D2284)", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await suite.kit.createProduct({ title: 'Synthetic bundle', sku: 'PACK-SKU-1', type: 'pack' });

    // Act
    const { preview } = await previewed(client, {
      format: 'csv',
      bytes: csvOf([
        ['product_key', 'name', 'price'],
        ['PACK-SKU-1', 'Synthetic bundle', '2500'],
      ]),
    });

    // Assert
    expect(preview.summary).toMatchObject({ updates: 0, errors: 1 });
    expect(preview.items[0]).toMatchObject({ action: 'error', messages: [CATALOG_IMPORT_ROW_ERRORS.TYPE_UNSUPPORTED] });
  });

  it('one file previewed twice and confirmed twice creates its products once (D2285)', async () => {
    // Arrange: two previews of the same new SKUs before either confirm (two tabs)
    await suite.kit.asOwner(suite.fixtures.a);
    const first = await previewed(client, { format: 'csv', bytes: csvOf(rowsOf('TWOTABS')) });
    const second = await previewed(client, { format: 'csv', bytes: csvOf(rowsOf('TWOTABS')) });

    // Act
    await client.confirm(first.importId);
    await client.settled(first.importId);
    await client.confirm(second.importId);
    const done = await client.settled(second.importId);

    // Assert
    expect(await countOf('TWOTABS')).toBe(ROWS);
    expect(done.result).toEqual({ created: 0, updated: 0, failed: ROWS });
  });
});
