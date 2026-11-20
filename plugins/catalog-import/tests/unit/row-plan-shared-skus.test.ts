import { CATALOG_IMPORT_ROW_ERRORS, type ImportFieldKey } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { writeGroupKeyOf } from '../../domain/row-groups';
import { type PlanLookups, planRows, type SkuLookup } from '../../domain/row-plan';
import { validateRow } from '../../domain/row-validate';

const E = CATALOG_IMPORT_ROW_ERRORS;

type Cells = Partial<Record<ImportFieldKey, string>>;

/** Validated rows numbered from 2 (the header is line 1). */
const rowsOf = (...cells: Cells[]) => cells.map((row, index) => validateRow({ rowNumber: index + 2, cells: row }));

function lookups(change: Partial<PlanLookups> = {}): PlanLookups {
  return {
    skus: new Map<string, SkuLookup>(),
    productIds: new Set<string>(),
    brands: new Map([['acme', '501']]),
    tags: new Map([['cotton', '601']]),
    canUpdate: true,
    ...change,
  };
}

const one = (productId: string, variantId: string | null = null): SkuLookup => ({ kind: 'one', productId, variantId });

describe('planRows: rows sharing a product or a SKU (D2267, D2268)', () => {
  it('rows without a key naming two variants of one product by SKU both update it, as one write group (D2268)', () => {
    // Arrange: a hand-made "update prices by SKU" file
    const rows = rowsOf(
      { name: 'Shirt', price: '1000', variant_sku: 'V1' },
      { name: 'Shirt', price: '1200', variant_sku: 'V2' },
    );
    const found = lookups({
      skus: new Map([
        ['V1', one('7', '71')],
        ['V2', one('7', '72')],
      ]),
    });

    // Act
    const planned = planRows(rows, found);

    // Assert
    expect(planned.map((row) => [row.action, row.productId, row.variantId, row.messages])).toEqual([
      ['update', '7', '71', []],
      ['update', '7', '72', []],
    ]);
    expect(planned.map(writeGroupKeyOf)).toEqual(['#7', '#7']);
  });

  it('a row without a key naming a product a keyed group already updates is a duplicate (D2267, D2268)', () => {
    // Arrange
    const rows = rowsOf(
      { product_key: 'id:7', name: 'Shirt', price: '1000' },
      { name: 'Shirt', price: '1200', variant_sku: 'V2' },
    );
    const found = lookups({ productIds: new Set(['7']), skus: new Map([['V2', one('7', '72')]]) });

    // Act
    const planned = planRows(rows, found);

    // Assert
    expect(planned.map((row) => [row.action, row.messages])).toEqual([
      ['update', []],
      ['error', [E.DUPLICATE_IN_FILE]],
    ]);
  });

  it("a variant SKU equal to another group's product key is a duplicate in the file (D2268)", () => {
    // Arrange: both rows would create a product with SKU K1
    const rows = rowsOf(
      { product_key: 'K1', name: 'A', price: '1' },
      { name: 'B', price: '2', variant_sku: 'k1' },
      { product_key: 'K2', name: 'C', price: '3', option1_name: 'Size', option1_value: 'S', variant_sku: 'K2-S' },
      { product_key: 'K2-S', name: 'D', price: '4' },
    );

    // Act
    const planned = planRows(rows, lookups());

    // Assert
    expect(planned.map((row) => [row.action, row.messages])).toEqual([
      ['create', []],
      ['error', [E.DUPLICATE_IN_FILE]],
      ['create', []],
      ['error', [E.DUPLICATE_IN_FILE]],
    ]);
  });

  it("a group's own key may equal its own variant SKU", () => {
    // Act
    const planned = planRows(rowsOf({ product_key: 'K1', name: 'A', price: '1', variant_sku: 'k1' }), lookups());

    // Assert
    expect(planned[0]).toMatchObject({ action: 'create', messages: [] });
  });
});
