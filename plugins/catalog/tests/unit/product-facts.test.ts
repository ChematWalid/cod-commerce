import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { type FactsProductRow, type FactsVariantRow, factsOf, ruleOptionsFrom } from '../../application/product-facts';
import { toCoreId } from '../../domain/core-id';

const PRODUCT_ID = toCoreId('7');

const product = (overrides: Partial<FactsProductRow> = {}): FactsProductRow => ({
  productId: PRODUCT_ID,
  title: 'Shirt',
  status: 'active',
  brandId: null,
  defaultPrice: 2500,
  optionGroupCount: 1,
  ...overrides,
});

const variant = (overrides: Partial<FactsVariantRow> = {}): FactsVariantRow => ({
  productId: PRODUCT_ID,
  hidden: false,
  price: 1000,
  oldPrice: null,
  options: [],
  ...overrides,
});

describe('factsOf (D2304)', () => {
  it('price is the lowest visible variant price', () => {
    // Arrange
    const variants = [variant({ price: 3000 }), variant({ price: 800 }), variant({ price: 100, hidden: true })];

    // Act
    const facts = factsOf(product(), variants, []);

    // Assert
    expect(facts.price).toBe(800);
  });

  it('price falls back to the product price when no variant is visible', () => {
    // Arrange
    const variants = [variant({ price: 100, hidden: true })];

    // Act
    const facts = factsOf(product({ defaultPrice: 2500 }), variants, []);

    // Assert
    expect(facts.price).toBe(2500);
  });

  it('the product price of a product without options is its only variant price, as the catalog shows it', () => {
    // Arrange
    const variants = [variant({ price: 900, hidden: true })];

    // Act
    const facts = factsOf(product({ optionGroupCount: 0, defaultPrice: null }), variants, []);

    // Assert
    expect(facts.price).toBe(900);
  });

  it('on sale only from visible variants', () => {
    // Arrange
    const hiddenSale = [variant({ price: 900, oldPrice: 1200, hidden: true }), variant({ price: 900 })];
    const visibleSale = [variant({ price: 900, oldPrice: 1200 })];
    const equalPrices = [variant({ price: 900, oldPrice: 900 })];

    // Act
    const results = [hiddenSale, visibleSale, equalPrices].map((variants) => factsOf(product(), variants, []).onSale);

    // Assert
    expect(results).toEqual([false, true, false]);
  });

  it('variantOptions skip hidden variants', () => {
    // Arrange
    const red = [{ name: 'Color', value: 'Red' }];
    const blue = [{ name: 'Color', value: 'Blue' }];
    const variants = [variant({ options: red, hidden: true }), variant({ options: blue })];

    // Act
    const facts = factsOf(product(), variants, []);

    // Assert
    expect(facts.variantOptions).toEqual([blue]);
  });

  it('carries the title, status, brand and tags as read', () => {
    // Arrange
    const row = product({ title: 'حذاء', status: 'draft', brandId: toSnowflake('42') });

    // Act
    const facts = factsOf(row, [variant()], [toSnowflake('5'), toSnowflake('9')]);

    // Assert
    expect(facts).toMatchObject({
      productId: '7',
      title: 'حذاء',
      status: 'draft',
      brandId: '42',
      tagIds: ['5', '9'],
    });
  });
});

describe('ruleOptionsFrom (D2305, D2308)', () => {
  it('option names merge by normalForMatch', () => {
    // Arrange
    const rows = [
      { name: 'Color', value: 'Red' },
      { name: 'COLOR ', value: 'Blue' },
      { name: 'لَون', value: 'أحمر' },
      { name: 'لون', value: 'ازرق' },
    ];

    // Act
    const options = ruleOptionsFrom(rows);

    // Assert
    expect(options).toEqual([
      { name: 'Color', values: ['Blue', 'Red'] },
      { name: 'لَون', values: ['أحمر', 'ازرق'] },
    ]);
  });

  it('lists a value once whatever its written form, keeping the first spelling, and sorts the values', () => {
    // Arrange
    const rows = [
      { name: 'Size', value: 'M' },
      { name: 'Size', value: 's' },
      { name: 'Size', value: 'S' },
      { name: 'Size', value: 'L' },
    ];

    // Act
    const options = ruleOptionsFrom(rows);

    // Assert
    expect(options).toEqual([{ name: 'Size', values: ['L', 'M', 's'] }]);
  });

  it('leaves out a name or value whose normal form is empty', () => {
    // Arrange
    const rows = [
      { name: 'ـــ', value: 'Red' },
      { name: 'Color', value: 'ـ' },
      { name: 'Color', value: 'Red' },
    ];

    // Act
    const options = ruleOptionsFrom(rows);

    // Assert
    expect(options).toEqual([{ name: 'Color', values: ['Red'] }]);
  });
});
