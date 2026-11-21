import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_IMPORT_ROW_ERRORS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { importSuite } from './import-kit';
import { csvOf, importClient, previewed, productCount } from './import-flow-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const client = importClient(suite);
const E = CATALOG_IMPORT_ROW_ERRORS;
const HEADER = ['product_key', 'name', 'price', 'option1_name', 'option1_value', 'option2_name', 'option2_value'];

describe('the option matrix of an imported product (D2270)', () => {
  it('a sparse 2x2 matrix previews as errors and confirm creates only the previewed rows', async () => {
    // Arrange: SPARSE names Red/S and Blue/M only; the catalog would also create Red/M and Blue/S
    await suite.kit.asOwner(suite.fixtures.a);
    const before = await productCount(suite);
    const bytes = csvOf([
      HEADER,
      ['SPARSE', 'Sparse shirt', '1500', 'Color', 'Red', 'Size', 'S'],
      ['SPARSE', 'Sparse shirt', '1800', 'Color', 'Blue', 'Size', 'M'],
      ['MUG', 'Mug', '700', '', '', '', ''],
    ]);

    // Act
    const { importId, preview } = await previewed(client, { format: 'csv', bytes });
    await client.confirm(importId);
    const done = await client.settled(importId);

    // Assert
    expect(preview.summary).toMatchObject({ creates: 1, errors: 2 });
    expect(preview.items.filter((item) => item.productKey === 'SPARSE')).toEqual([
      expect.objectContaining({ rowNumber: 2, action: 'error', messages: [E.INVALID_VALUE] }),
      expect.objectContaining({ rowNumber: 3, action: 'error', messages: [E.INVALID_VALUE] }),
    ]);
    expect(done.result).toEqual({ created: 1, updated: 0, failed: 0 });
    expect(await productCount(suite)).toBe(before + 1);
  });

  it('a full 2x2 matrix creates its four variants at their own prices', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const bytes = csvOf([
      HEADER,
      ['FULL', 'Full shirt', '1500', 'Color', 'Red', 'Size', 'S'],
      ['FULL', 'Full shirt', '1600', 'Color', 'Red', 'Size', 'M'],
      ['FULL', 'Full shirt', '1700', 'Color', 'Blue', 'Size', 'S'],
      ['FULL', 'Full shirt', '1800', 'Color', 'Blue', 'Size', 'M'],
    ]);

    // Act
    const { importId, preview } = await previewed(client, { format: 'csv', bytes });
    await client.confirm(importId);
    await client.settled(importId);
    const { catalogProducts } = await suite.kit.gql<{ catalogProducts: { items: { id: string }[] } }>(
      'query { catalogProducts(options: { q: "Full shirt" }) { items { id } } }',
    );
    const { catalogProduct } = await suite.kit.gql<{ catalogProduct: { variants: { price: number }[] } }>(
      'query ($id: ID!) { catalogProduct(id: $id) { variants { price } } }',
      { id: catalogProducts.items[0]?.id },
    );

    // Assert
    expect(preview.summary).toMatchObject({ creates: 4, errors: 0 });
    expect(catalogProduct.variants.map((variant) => variant.price).sort()).toEqual([1500, 1600, 1700, 1800]);
  });
});
