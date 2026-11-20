import { CATALOG_IMPORT_ROW_ERRORS, type ImportFieldKey, MAX_OPTION_VALUES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
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
    brands: new Map(),
    tags: new Map(),
    canUpdate: true,
    ...change,
  };
}

const shirt = (color: string, size: string, price = '1500'): Cells => ({
  product_key: 'SHIRT',
  name: 'Shirt',
  price,
  option1_name: 'Color',
  option1_value: color,
  option2_name: 'Size',
  option2_value: size,
});

const actionsOf = (rows: ReturnType<typeof planRows>) => rows.map((row) => [row.action, row.messages]);

describe('planRows: the option matrix of a new product (D2270)', () => {
  it('rows naming every combination of their option values preview as creates', () => {
    // Act
    const planned = planRows(
      rowsOf(shirt('Red', 'S'), shirt('Red', 'M'), shirt('Blue', 'S'), shirt('Blue', 'M')),
      lookups(),
    );

    // Assert
    expect(planned.map((row) => row.action)).toEqual(['create', 'create', 'create', 'create']);
  });

  it('a sparse matrix (Red/S and Blue/M only) refuses the group: confirm would create combinations the file never listed', () => {
    // Act
    const planned = planRows(rowsOf(shirt('Red', 'S', '1500'), shirt('Blue', 'M', '1800')), lookups());

    // Assert
    expect(actionsOf(planned)).toEqual([
      ['error', [E.INVALID_VALUE]],
      ['error', [E.INVALID_VALUE]],
    ]);
  });

  it('a refused row of another group leaves a full matrix whole', () => {
    // Act
    const planned = planRows(
      rowsOf(
        shirt('Red', 'S'),
        shirt('Red', 'M'),
        shirt('Blue', 'S'),
        { ...shirt('Blue', 'M'), variant_sku: 'X' },
        {
          ...shirt('Blue', 'M'),
          product_key: 'OTHER',
          variant_sku: 'x',
        },
      ),
      lookups(),
    );

    // Assert: row 6 reuses row 5's SKU; rows 2-5 still cover the matrix, so they create
    expect(planned.map((row) => row.action)).toEqual(['create', 'create', 'create', 'create', 'error']);
  });

  it('a row refused on its own leaves a hole in the matrix, so the whole group is refused', () => {
    // Act
    const planned = planRows(
      rowsOf(shirt('Red', 'S'), shirt('Red', 'M'), shirt('Blue', 'S'), shirt('Blue', 'M', '-1')),
      lookups(),
    );

    // Assert
    expect(actionsOf(planned)).toEqual([
      ['error', [E.INVALID_VALUE]],
      ['error', [E.INVALID_VALUE]],
      ['error', [E.INVALID_VALUE]],
      ['error', [E.INVALID_VALUE]],
    ]);
  });

  it('a variant row without a price leaves a hole too', () => {
    // Act
    const planned = planRows(
      rowsOf(shirt('Red', 'S'), shirt('Red', 'M'), shirt('Blue', 'S'), { ...shirt('Blue', 'M'), price: '' }),
      lookups(),
    );

    // Assert
    expect(planned.map((row) => row.action)).toEqual(['error', 'error', 'error', 'error']);
  });

  it('more option values than the catalog allows refuses the group at preview, not at confirm', () => {
    // Arrange
    const rows = Array.from({ length: MAX_OPTION_VALUES + 1 }, (_, index) => ({
      product_key: 'MANY',
      name: 'Many',
      price: '100',
      option1_name: 'Size',
      option1_value: `S${String(index)}`,
    }));

    // Act
    const planned = planRows(rowsOf(...rows), lookups());

    // Assert
    expect(new Set(planned.map((row) => row.action))).toEqual(new Set(['error']));
  });

  it('an update group may name only some variants of its product', () => {
    // Act
    const planned = planRows(
      rowsOf({ ...shirt('Red', 'S'), variant_sku: 'SHIRT-RS' }, { ...shirt('Blue', 'M'), variant_sku: 'SHIRT-BM' }),
      lookups({
        skus: new Map<string, SkuLookup>([
          ['SHIRT', { kind: 'one', productId: '7', variantId: null }],
          ['SHIRT-RS', { kind: 'one', productId: '7', variantId: '71' }],
          ['SHIRT-BM', { kind: 'one', productId: '7', variantId: '74' }],
        ]),
      }),
    );

    // Assert
    expect(planned.map((row) => row.action)).toEqual(['update', 'update']);
  });
});
