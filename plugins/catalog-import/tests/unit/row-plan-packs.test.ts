import { CATALOG_IMPORT_ROW_ERRORS, type ImportFieldKey } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { type PlanLookups, planRows } from '../../domain/row-plan';
import { validateRow } from '../../domain/row-validate';

const E = CATALOG_IMPORT_ROW_ERRORS;

type Cells = Partial<Record<ImportFieldKey, string>>;

/** Validated rows numbered from 2 (the header is line 1). */
const rowsOf = (...cells: Cells[]) => cells.map((row, index) => validateRow({ rowNumber: index + 2, cells: row }));

/** Pack `9` of the store, named by its SKU, its variant's SKU and its id. */
function packLookups(): PlanLookups {
  return {
    skus: new Map([
      ['BUNDLE', { kind: 'one', productId: '9', variantId: '91', isPack: true }],
      ['BUNDLE-V', { kind: 'one', productId: '9', variantId: '91', isPack: true }],
    ]),
    productIds: new Set(['9']),
    packIds: new Set(['9']),
    brands: new Map(),
    tags: new Map(),
    canUpdate: true,
  };
}

describe('a row targeting a pack (D2284)', () => {
  it('a product key naming a pack by SKU is row-type-unsupported, not an update', () => {
    // Act
    const planned = planRows(rowsOf({ product_key: 'BUNDLE', name: 'Bundle', price: '1500' }), packLookups());

    // Assert
    expect(planned[0]).toMatchObject({ action: 'error', messages: [E.TYPE_UNSUPPORTED] });
  });

  it("a keyless row whose variant SKU is a pack's is row-type-unsupported", () => {
    // Act
    const planned = planRows(rowsOf({ name: 'Bundle', price: '1500', variant_sku: 'BUNDLE-V' }), packLookups());

    // Assert
    expect(planned[0]).toMatchObject({ action: 'error', messages: [E.TYPE_UNSUPPORTED] });
  });

  it('an id key naming a pack is row-type-unsupported', () => {
    // Act
    const planned = planRows(rowsOf({ product_key: 'id:9', name: 'Bundle', price: '1500' }), packLookups());

    // Assert
    expect(planned[0]).toMatchObject({ action: 'error', messages: [E.TYPE_UNSUPPORTED] });
  });
});
