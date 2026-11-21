import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { beforeAll, describe, expect, it } from 'vitest';
import { exportClient } from './export-kit';
import { importSuite } from './import-kit';
import { importClient, previewed, productCount } from './import-flow-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const exports = exportClient(suite);
const imports = importClient(suite);
const FORMULA_TITLE = '=HYPERLINK("x")';

/** Signs in as B's owner on B's second store, which holds only this file's products. */
const asRoundTripStore = (): Promise<void> => suite.kit.asOwner(suite.fixtures.b, suite.fixtures.b.stores[1]);

describe('export → import round trip (AC3, D2209, D2220, Review Focus 2)', () => {
  let physicalProducts: number;

  beforeAll(async () => {
    await asRoundTripStore();
    await suite.kit.createProduct({
      title: 'Round trip tee',
      sku: 'RT-TEE',
      price: 1500,
      optionGroups: [{ name: 'Size', values: ['S', 'M'] }],
    });
    await suite.kit.createProduct({ title: 'Round trip without SKU', price: 700 });
    await suite.kit.createProduct({ title: FORMULA_TITLE, sku: 'RT-FORMULA', price: 300 });
    await suite.kit.createProduct({ title: 'Round trip pack', type: 'pack', price: 0 });
    physicalProducts = 3;
  });

  it.each(['csv', 'xlsx'] as const)(
    'filtered %s export re-imports as updates only, zero errors and warnings, product count unchanged after confirm',
    async (format) => {
      // Arrange
      await asRoundTripStore();
      const before = await productCount(suite);
      const exported = await exports.exportProducts({ scope: 'filtered', format, query: { tab: 'all' } });
      const bytes = await exports.fileOf(exported.downloadUrl ?? '');

      // Act
      const { importId, preview } = await previewed(imports, { format, bytes });
      await imports.confirm(importId);
      const done = await imports.settled(importId);

      // Assert: the tee writes two rows (one per size), the pack none (D2220)
      expect(exported).toMatchObject({ status: 'done', skippedPacks: 1 });
      expect(preview.summary).toEqual({ creates: 0, updates: physicalProducts + 1, errors: 0, warnings: 0 });
      expect(done.result).toEqual({ created: 0, updated: physicalProducts + 1, failed: 0 });
      expect(await productCount(suite)).toBe(before);
      const { catalogProducts } = await suite.kit.gql<{ catalogProducts: { items: { title: string }[] } }>(
        'query { catalogProducts(options: { q: "RT-FORMULA" }) { items { title } } }',
      );
      expect(catalogProducts.items.map((item) => item.title)).toEqual([FORMULA_TITLE]);
    },
  );
});
