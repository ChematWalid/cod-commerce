import { CATALOG_IMPORT_ROW_WARNINGS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { hasRequiredFields, mapColumns } from '../../domain/column-mapper';

const W = CATALOG_IMPORT_ROW_WARNINGS;

describe('mapColumns (D2209, D2224)', () => {
  it('maps السعر, prix and price to price', () => {
    // Act
    const fields = ['السعر', 'Prix', 'PRICE', 'Prix de vente'].map(
      (header) => mapColumns([header]).assignments[0]?.field,
    );

    // Assert
    expect(fields).toEqual(['price', 'price', 'price', 'price']);
  });

  it('maps every column of an Arabic header, harakat and tatweel aside', () => {
    // Act
    const map = mapColumns(['الاسـم', 'السِّعر', 'الوزن (غ)', 'رمز SKU']);

    // Assert
    expect(map.assignments.map((assignment) => assignment.field)).toEqual(['name', 'price', 'weight', 'variant_sku']);
    expect(map.warnings).toEqual([]);
    expect(hasRequiredFields(map)).toBe(true);
  });

  it('unknown column ignored with a warning', () => {
    // Act
    const map = mapColumns(['name', 'price', 'Supplier notes', '']);

    // Assert
    expect(map.assignments).toEqual([
      { column: 0, header: 'name', field: 'name' },
      { column: 1, header: 'price', field: 'price' },
      { column: 2, header: 'Supplier notes', field: null },
      { column: 3, header: '', field: null },
    ]);
    expect(map.warnings).toEqual([{ column: 2, reason: W.UNKNOWN_COLUMN }]);
  });

  it('a second column of the same field is ignored with a warning', () => {
    // Act
    const map = mapColumns(['name', 'title', 'price']);

    // Assert
    expect(map.assignments.map((assignment) => assignment.field)).toEqual(['name', null, 'price']);
    expect(map.warnings).toEqual([{ column: 1, reason: W.UNKNOWN_COLUMN }]);
  });

  it('override wins', () => {
    // Act: column 2 is the merchant's price; the detected price column is left unmapped
    const map = mapColumns(['name', 'price', 'Our price'], [{ column: 2, field: 'price' }]);

    // Assert
    expect(map.assignments.map((assignment) => assignment.field)).toEqual(['name', null, 'price']);
    expect(map.warnings).toEqual([]);
  });

  it('an override of null unmaps a detected column', () => {
    // Act
    const map = mapColumns(['name', 'price', 'description'], [{ column: 2, field: null }]);

    // Assert
    expect(map.assignments[2]?.field).toBeNull();
    expect(map.warnings).toEqual([]);
  });

  it('collections column is ignored with a warning until P2.S3', () => {
    // Act
    const map = mapColumns(['name', 'price', 'Collections']);

    // Assert
    expect(map.assignments[2]).toEqual({ column: 2, header: 'Collections', field: null });
    expect(map.warnings).toEqual([{ column: 2, reason: W.COLLECTIONS_IGNORED }]);
  });

  it('a file without a price column lacks a required field', () => {
    // Act and Assert
    expect(hasRequiredFields(mapColumns(['name', 'sku']))).toBe(false);
  });
});
