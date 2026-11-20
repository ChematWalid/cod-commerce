import { CATALOG_IMPORT_ROW_ERRORS, CATALOG_IMPORT_ROW_WARNINGS, type ImportFieldKey } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { type PlanLookups, planRows, type SkuLookup } from '../../domain/row-plan';
import { validateRow } from '../../domain/row-validate';

const E = CATALOG_IMPORT_ROW_ERRORS;
const W = CATALOG_IMPORT_ROW_WARNINGS;

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

describe('planRows (D2209, Review Focus 3)', () => {
  it('groups variant rows by product_key', () => {
    // Arrange
    const rows = rowsOf(
      { product_key: 'TSHIRT', name: 'Shirt', price: '1500', option1_name: 'Size', option1_value: 'S' },
      { product_key: 'TSHIRT', name: 'Shirt', price: '1600', option1_name: 'Size', option1_value: 'M' },
      { product_key: 'MUG', name: 'Mug', price: '700' },
    );

    // Act
    const planned = planRows(rows, lookups());

    // Assert
    expect(
      planned.map(({ rowNumber, action, productKey, messages }) => ({ rowNumber, action, productKey, messages })),
    ).toEqual([
      { rowNumber: 2, action: 'create', productKey: 'TSHIRT', messages: [] },
      { rowNumber: 3, action: 'create', productKey: 'TSHIRT', messages: [] },
      { rowNumber: 4, action: 'create', productKey: 'MUG', messages: [] },
    ]);
  });

  it('a row without a product key is its own product', () => {
    // Act
    const planned = planRows(rowsOf({ name: 'A', price: '1' }, { name: 'B', price: '2' }), lookups());

    // Assert
    expect(planned.map((row) => row.productKey)).toEqual([null, null]);
  });

  it('two rows with the same variant_sku: the second is a duplicate in the file', () => {
    // Act
    const planned = planRows(
      rowsOf({ name: 'A', price: '1', variant_sku: 'SKU-1' }, { name: 'B', price: '2', variant_sku: 'sku-1' }),
      lookups(),
    );

    // Assert
    expect(planned.map((row) => [row.action, row.messages])).toEqual([
      ['create', []],
      ['error', [E.DUPLICATE_IN_FILE]],
    ]);
  });

  it('a SKU held by two variants of the store is ambiguous', () => {
    // Act
    const planned = planRows(
      rowsOf({ name: 'A', price: '1', variant_sku: 'TWICE' }),
      lookups({ skus: new Map([['TWICE', { kind: 'ambiguous' }]]) }),
    );

    // Assert
    expect(planned[0]).toMatchObject({ action: 'error', messages: [E.AMBIGUOUS] });
  });

  it("a SKU only held in business B is a create in A (the store's lookup does not find it)", () => {
    // Act
    const planned = planRows(
      rowsOf({ product_key: 'B-ONLY', name: 'A', price: '1', variant_sku: 'B-ONLY' }),
      lookups(),
    );

    // Assert
    expect(planned[0]).toMatchObject({ action: 'create', productId: null, messages: [] });
  });

  it('an existing SKU previews an update of its product and variant', () => {
    // Act
    const planned = planRows(
      rowsOf({ product_key: 'P-1', name: 'A', price: '1', variant_sku: 'P-1-RED' }),
      lookups({
        skus: new Map([
          ['P-1', one('7')],
          ['P-1-RED', one('7', '70')],
        ]),
      }),
    );

    // Assert
    expect(planned[0]).toMatchObject({ action: 'update', productId: '7', variantId: '70', messages: [] });
  });

  it('an id:<n> of another store, of business B and a missing id give the same reason id', () => {
    // Arrange: only product 5 is in the active store
    const rows = rowsOf(
      { product_key: 'id:5', name: 'Own', price: '1' },
      { product_key: 'id:900', name: 'Other store', price: '1' },
      { product_key: 'id:901', name: 'Business B', price: '1' },
      { product_key: 'id:999999', name: 'Missing', price: '1' },
    );

    // Act
    const planned = planRows(rows, lookups({ productIds: new Set(['5']) }));

    // Assert
    expect(planned.map((row) => [row.action, row.messages])).toEqual([
      ['update', []],
      ['error', [E.PRODUCT_NOT_FOUND]],
      ['error', [E.PRODUCT_NOT_FOUND]],
      ['error', [E.PRODUCT_NOT_FOUND]],
    ]);
  });

  it('conflicting weights in one product_key: first row wins, later rows warn', () => {
    // Act
    const planned = planRows(
      rowsOf(
        { product_key: 'K', name: 'A', price: '1', weight: '200', option1_name: 'Size', option1_value: 'S' },
        { product_key: 'K', name: 'A', price: '1', weight: '300', option1_name: 'Size', option1_value: 'M' },
        { product_key: 'K', name: 'A', price: '1', weight: '200', option1_name: 'Size', option1_value: 'L' },
      ),
      lookups(),
    );

    // Assert
    expect(planned.map((row) => [row.action, row.messages])).toEqual([
      ['create', []],
      ['create', [W.WEIGHT_CONFLICT]],
      ['create', []],
    ]);
  });

  it('unknown brand or tag name gives a warning and the field is ignored', () => {
    // Act
    const planned = planRows(
      rowsOf(
        { name: 'A', price: '1', brand: 'Nobody', tags: 'COTTON;unknown' },
        { name: 'B', price: '1', brand: 'acme' },
      ),
      lookups(),
    );

    // Assert
    expect(planned[0]).toMatchObject({
      action: 'create',
      messages: [W.UNKNOWN_TAXONOMY],
      tagIds: ['601'],
    });
    expect(planned[0]?.brandId).toBeUndefined();
    expect(planned[1]).toMatchObject({ action: 'create', messages: [], brandId: '501' });
  });

  it('an update row without edit permission is update-forbidden', () => {
    // Act
    const planned = planRows(
      rowsOf({ product_key: 'P-1', name: 'A', price: '1' }, { product_key: 'NEW', name: 'B', price: '1' }),
      lookups({ skus: new Map([['P-1', one('7')]]), canUpdate: false }),
    );

    // Assert
    expect(planned.map((row) => [row.action, row.messages])).toEqual([
      ['error', [E.UPDATE_FORBIDDEN]],
      ['create', []],
    ]);
  });

  it('a create row without a price is invalid', () => {
    // Act
    const planned = planRows(rowsOf({ name: 'A' }), lookups());

    // Assert
    expect(planned[0]).toMatchObject({ action: 'error', messages: [E.INVALID_VALUE] });
  });

  it('a variant SKU held by another product than the row group targets is ambiguous', () => {
    // Act
    const planned = planRows(
      rowsOf({ product_key: 'P-1', name: 'A', price: '1', variant_sku: 'Q-RED' }),
      lookups({
        skus: new Map([
          ['P-1', one('7')],
          ['Q-RED', one('8', '80')],
        ]),
      }),
    );

    // Assert
    expect(planned[0]).toMatchObject({ action: 'error', messages: [E.AMBIGUOUS] });
  });

  it('two rows of one new product naming the same option values: the second is a duplicate', () => {
    // Act
    const planned = planRows(
      rowsOf(
        { product_key: 'K', name: 'A', price: '1', option1_name: 'Size', option1_value: 'S' },
        { product_key: 'K', name: 'A', price: '2', option1_name: 'Size', option1_value: 's' },
      ),
      lookups(),
    );

    // Assert
    expect(planned.map((row) => row.action)).toEqual(['create', 'error']);
    expect(planned[1]?.messages).toEqual([E.DUPLICATE_IN_FILE]);
  });

  it('an invalid row stays an error with its own reasons', () => {
    // Act
    const planned = planRows(rowsOf({ name: 'A', price: '-1', product_key: 'K' }), lookups());

    // Assert
    expect(planned[0]).toMatchObject({ action: 'error', productKey: 'K', messages: [E.INVALID_VALUE] });
  });
});
