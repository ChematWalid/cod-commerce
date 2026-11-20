import { CATALOG_IMPORT_ROW_ERRORS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { type ImportTargetProduct, updateOf } from '../../domain/import-writes';
import { plannedRow } from '../fakes/fake-import';

const E = CATALOG_IMPORT_ROW_ERRORS;

const shirt: ImportTargetProduct = {
  id: '7',
  hasOptions: true,
  variants: [{ id: '71', sku: 'SHIRT-BLUE', optionValues: ['Blue'] }],
};

const rowOf = (rowNumber: number, name: string, colour: string) =>
  plannedRow({
    rowNumber,
    action: 'update',
    productId: '7',
    values: {
      name,
      description: `${name} text`,
      price: 1500,
      options: [{ name: 'Colour', value: colour }],
      imageUrls: [],
    },
  });

describe('updateOf (D2209, D2262)', () => {
  it('takes the product fields from the first placed row, not from a refused one', () => {
    // Arrange: row 2 names a variant gone since the preview; row 3 is placed
    const rows = [rowOf(2, 'Red name', 'Red'), rowOf(3, 'Blue name', 'Blue')];

    // Act
    const { update, refused } = updateOf(rows, shirt);

    // Assert
    expect(refused).toEqual(new Map([[2, E.VARIANT_NOT_FOUND]]));
    expect(update).toMatchObject({ title: 'Blue name', description: 'Blue name text' });
    expect(update.variants.map((variant) => variant.id)).toEqual(['71']);
  });

  it('a group whose every row is refused changes no product field', () => {
    // Act
    const { update, refused } = updateOf([rowOf(2, 'Red name', 'Red')], shirt);

    // Assert
    expect(refused.size).toBe(1);
    expect(update).toEqual({ variants: [] });
  });
});
