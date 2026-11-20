import { CATALOG_IMPORT_ROW_ERRORS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { validateRow } from '../../domain/row-validate';

const E = CATALOG_IMPORT_ROW_ERRORS;

describe('validateRow (D2209)', () => {
  it('a valid row parses prices, weight, tags, options and links', () => {
    // Act
    const row = validateRow({
      rowNumber: 4,
      cells: {
        product_key: 'TSHIRT',
        name: ' Shirt ',
        status: 'Hidden',
        type: 'physical',
        price: '1500',
        old_price: '1800.0',
        weight: '250',
        brand: 'Acme',
        tags: 'cotton; summer',
        option1_name: 'Size',
        option1_value: 'M',
        variant_sku: 'TSHIRT-M',
        image_urls: 'https://img.example/a.jpg',
      },
    });

    // Assert
    expect(row).toEqual({
      rowNumber: 4,
      errors: [],
      values: {
        productKey: 'TSHIRT',
        name: 'Shirt',
        status: 'hidden',
        price: 1500,
        oldPrice: 1800,
        weight: 250,
        brand: 'Acme',
        tags: ['cotton', 'summer'],
        options: [{ name: 'Size', value: 'M' }],
        variantSku: 'TSHIRT-M',
        imageUrls: ['https://img.example/a.jpg'],
      },
    });
  });

  it('negative price', () => {
    // Act
    const row = validateRow({ rowNumber: 2, cells: { name: 'Shirt', price: '-5' } });

    // Assert
    expect(row.errors).toEqual([E.INVALID_VALUE]);
  });

  it('a price with a fraction or text is invalid; an empty one is absent', () => {
    // Act and Assert
    expect(validateRow({ rowNumber: 2, cells: { name: 'A', price: '15.5' } }).errors).toEqual([E.INVALID_VALUE]);
    expect(validateRow({ rowNumber: 2, cells: { name: 'A', price: 'free' } }).errors).toEqual([E.INVALID_VALUE]);
    expect(validateRow({ rowNumber: 2, cells: { name: 'A', price: ' ' } })).toMatchObject({
      errors: [],
      values: { name: 'A' },
    });
  });

  it('status outside active/hidden/draft', () => {
    // Act
    const row = validateRow({ rowNumber: 2, cells: { name: 'Shirt', price: '1', status: 'archived' } });

    // Assert
    expect(row.errors).toEqual([E.INVALID_VALUE]);
  });

  it('type pack refused', () => {
    // Act
    const row = validateRow({ rowNumber: 2, cells: { name: 'Bundle', price: '1', type: 'pack' } });

    // Assert
    expect(row.errors).toEqual([E.TYPE_UNSUPPORTED]);
  });

  it('a row without a name is invalid', () => {
    // Act and Assert
    expect(validateRow({ rowNumber: 2, cells: { price: '1' } }).errors).toEqual([E.INVALID_VALUE]);
  });

  it("'=x' unescaped", () => {
    // Act
    const row = validateRow({ rowNumber: 2, cells: { name: '\'=HYPERLINK("x")', price: '1', tags: "'@home" } });

    // Assert
    expect(row.values).toMatchObject({ name: '=HYPERLINK("x")', tags: ['@home'] });
  });

  it("a `'` before a non-trigger is kept", () => {
    // Act
    const row = validateRow({ rowNumber: 2, cells: { name: "'abc", price: '1' } });

    // Assert
    expect(row.values.name).toBe("'abc");
  });

  it('an option value without its name is invalid', () => {
    // Act
    const row = validateRow({ rowNumber: 2, cells: { name: 'A', price: '1', option2_value: 'Red' } });

    // Assert
    expect(row.errors).toEqual([E.INVALID_VALUE]);
  });

  it('a bad image link is an image-url error', () => {
    // Act
    const row = validateRow({ rowNumber: 2, cells: { name: 'A', price: '1', image_urls: 'file:///etc/passwd' } });

    // Assert
    expect(row.errors).toEqual([E.IMAGE_URL]);
  });

  it('a SKU longer than the catalog allows is invalid', () => {
    // Act
    const row = validateRow({ rowNumber: 2, cells: { name: 'A', price: '1', variant_sku: 'S'.repeat(65) } });

    // Assert
    expect(row.errors).toEqual([E.INVALID_VALUE]);
  });
});
