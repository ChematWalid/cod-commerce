import { EXPORT_HEADER } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  exportColumnsFor,
  exportRowsOf,
  type NamedExportProduct,
  projectRow,
  taxonomyNamesIndex,
  toExportRows,
  withTaxonomyNames,
} from '../../domain/export-row';

/** A product as the export reads it: one default variant unless the test gives options. */
function productOf(overrides: Partial<NamedExportProduct> = {}): NamedExportProduct {
  return {
    id: '41',
    title: 'Robe kabyle',
    description: 'Synthetic description',
    status: 'active',
    type: 'physical',
    sku: 'ROBE',
    weight: 650,
    brandId: null,
    tagIds: [],
    brandName: null,
    tagNames: [],
    optionGroups: [],
    variants: [{ sku: 'ROBE', price: 4500, oldPrice: 5000, barcode: '6130000000017', optionValues: [] }],
    ...overrides,
  };
}

describe('export rows (D2209)', () => {
  it('one row per variant with option pairs', () => {
    // Arrange
    const product = productOf({
      optionGroups: [{ name: 'Taille' }, { name: 'Couleur' }],
      variants: [
        { sku: 'ROBE-S-R', price: 4500, oldPrice: null, barcode: null, optionValues: ['S', 'Rouge'] },
        { sku: 'ROBE-M-R', price: 4700, oldPrice: null, barcode: null, optionValues: ['M', 'Rouge'] },
      ],
    });

    // Act
    const rows = toExportRows(product);

    // Assert
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => [row.option1_name, row.option1_value, row.option2_name, row.option2_value])).toEqual([
      ['Taille', 'S', 'Couleur', 'Rouge'],
      ['Taille', 'M', 'Couleur', 'Rouge'],
    ]);
    expect(rows.map((row) => [row.option3_name, row.option3_value])).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(rows.map((row) => row.variant_sku)).toEqual(['ROBE-S-R', 'ROBE-M-R']);
    expect(rows.map((row) => row.product_key)).toEqual(['ROBE', 'ROBE']);
  });

  it('a product without SKU gets product_key id:<id>', () => {
    // Arrange
    const product = productOf({ id: '77', sku: null });
    const blank = productOf({ id: '78', sku: '  ' });

    // Act
    const [row] = toExportRows(product);
    const [blankRow] = toExportRows(blank);

    // Assert
    expect(row?.product_key).toBe('id:77');
    expect(blankRow?.product_key).toBe('id:78');
  });

  it('prices are whole DZD, unscaled', () => {
    // Arrange
    const product = productOf({
      variants: [{ sku: 'X', price: 2_147_483_647, oldPrice: 1999, barcode: null, optionValues: [] }],
    });

    // Act
    const [row] = toExportRows(product);

    // Assert
    expect(row?.price).toBe(2_147_483_647);
    expect(row?.old_price).toBe(1999);
  });

  it('a pack product yields no row and counts as skipped', () => {
    // Arrange
    const pack = productOf({ id: '90', type: 'pack' });
    const physical = productOf({ id: '91' });

    // Act
    const rows = toExportRows(pack);
    const batch = exportRowsOf([{ product: pack }, { product: physical }]);

    // Assert
    expect(rows).toEqual([]);
    expect(batch.skippedPacks).toBe(1);
    expect(batch.rows).toHaveLength(1);
  });

  it('writes the product fields, brand and tag names, weight and the origin image links', () => {
    // Arrange
    const index = taxonomyNamesIndex({
      brands: [{ id: 'b1', name: 'Atlas' }],
      tags: [
        { id: 't1', name: 'Été' },
        { id: 't2', name: 'Promo' },
      ],
    });
    const product = withTaxonomyNames(productOf({ brandId: 'b1', tagIds: ['t2', 't1', 'gone'] }), index);

    // Act
    const [row] = toExportRows(product, {
      imageUrls: ['https://cdn.example.test/a.jpg', 'https://cdn.example.test/b.jpg'],
    });

    // Assert
    expect(row).toMatchObject({
      name: 'Robe kabyle',
      description: 'Synthetic description',
      status: 'active',
      type: 'physical',
      weight: 650,
      brand: 'Atlas',
      tags: 'Promo;Été',
      collections: null,
      barcode: '6130000000017',
      image_urls: 'https://cdn.example.test/a.jpg;https://cdn.example.test/b.jpg',
    });
  });

  it('projects a row onto the asked columns, in the given order', () => {
    // Arrange
    const [row] = toExportRows(productOf());
    if (row === undefined) throw new Error('no row');

    // Act
    const all = projectRow(row, EXPORT_HEADER);
    const some = projectRow(row, ['product_key', 'name', 'price']);

    // Assert
    expect(all).toHaveLength(EXPORT_HEADER.length);
    expect(some).toEqual(['ROBE', 'Robe kabyle', 4500]);
  });

  it('adds variant_sku and the used option pairs to a partial export of a product with variants (D2260)', () => {
    // Arrange
    const sized = productOf({
      optionGroups: [{ name: 'Taille' }],
      variants: ['S', 'M', 'L'].map((size, index) => ({
        sku: `ROBE-${size}`,
        price: 1000 + index * 100,
        oldPrice: null,
        barcode: null,
        optionValues: [size],
      })),
    });

    // Act
    const columns = exportColumnsFor(['product_key', 'name', 'price', 'brand'], [sized]);

    // Assert
    expect(columns).toEqual(['product_key', 'name', 'price', 'brand', 'option1_name', 'option1_value', 'variant_sku']);
  });

  it('keeps the asked columns of single-variant products and packs as they are (D2260)', () => {
    // Arrange
    const pack = productOf({ type: 'pack', optionGroups: [{ name: 'Taille' }] });
    const asked = ['product_key', 'name', 'price', 'brand'] as const;

    // Act
    const columns = exportColumnsFor(asked, [productOf(), pack]);

    // Assert
    expect(columns).toEqual(asked);
  });
  it('escapes a ; inside a tag name or an image link, and a SKU starting id: (D2261)', () => {
    // Arrange
    const product = productOf({ sku: 'id:7', tagNames: ['Summer; 2026'] });

    // Act
    const [row] = toExportRows(product, { imageUrls: ['https://img.example/a;v=2.jpg'] });

    // Assert
    expect(row).toMatchObject({
      product_key: '\\id:7',
      tags: 'Summer\\; 2026',
      image_urls: 'https://img.example/a\\;v=2.jpg',
    });
  });
});
