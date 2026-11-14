import { describe, expect, it } from 'vitest';
import {
  brandInputSchema,
  CATALOG_ERROR_CODES,
  highlightInputSchema,
  INT_COLUMN_MAX,
  optionGroupInputSchema,
  productInputSchema,
  productListQuerySchema,
  productPatchSchema,
  productSettingsPatchSchema,
  productSettingsSchema,
  quantityRulesSchema,
  soldOutOrdersInputSchema,
  tagInputSchema,
  variantPatchSchema,
} from '../../src/index';

const INVALID = CATALOG_ERROR_CODES.INVALID_INPUT;
const WRONG_TYPES: readonly [string, unknown][] = [
  ['null', null],
  ['a string', 'x'],
  ['a number', 1],
];

const validProduct = { title: 'Red shoe', status: 'active', type: 'physical', price: 2500 };
const validSettings = {
  isFragile: false,
  allowParcelOpening: true,
  allowOutOfStockOrders: true,
  soldOut: false,
  quantityRules: { enabled: true, min: 1, step: 1 },
};

/** The messages of a refused parse; an accepted one has none. */
function messagesOf(result: { error?: { issues: { message: string }[] } }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

const TOP_LEVEL_SCHEMAS = [
  ['productInputSchema', productInputSchema],
  ['productPatchSchema', productPatchSchema],
  ['productSettingsSchema', productSettingsSchema],
  ['productSettingsPatchSchema', productSettingsPatchSchema],
  ['quantityRulesSchema', quantityRulesSchema],
  ['optionGroupInputSchema', optionGroupInputSchema],
  ['variantPatchSchema', variantPatchSchema],
  ['brandInputSchema', brandInputSchema],
  ['tagInputSchema', tagInputSchema],
  ['highlightInputSchema', highlightInputSchema],
  ['soldOutOrdersInputSchema', soldOutOrdersInputSchema],
  ['productListQuerySchema', productListQuerySchema],
] as const;

describe('catalog schemas refuse a value of the wrong type with the catalog code', () => {
  it.each(
    TOP_LEVEL_SCHEMAS.flatMap(([name, schema]) => WRONG_TYPES.map(([kind, value]) => [name, kind, schema, value])),
  )('%s refuses %s', (_name, _kind, schema, value) => {
    // Act
    const result = (schema as typeof productInputSchema).safeParse(value);

    // Assert
    expect(result.success).toBe(false);
    expect(messagesOf(result)).toEqual([INVALID]);
  });

  it.each([
    ['seo', { ...validProduct, seo: null }],
    ['settings', { ...validProduct, settings: null }],
    ['quantityRules', { ...validProduct, settings: { ...validSettings, quantityRules: null } }],
    ['a custom attribute', { ...validProduct, settings: { ...validSettings, customAttributes: [null] } }],
    ['an option group', { ...validProduct, optionGroups: [null] }],
    ['an option group given as text', { ...validProduct, optionGroups: ['Color'] }],
  ])('refuses a null or wrong-type nested %s in a product', (_field, input) => {
    // Act
    const result = productInputSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
    expect(new Set(messagesOf(result))).toEqual(new Set([INVALID]));
  });

  it.each([
    ['settings', { settings: 'x' }],
    ['quantityRules', { settings: { quantityRules: 1 } }],
    ['a variant', { variants: [null] }],
    ['seo', { seo: 1 }],
  ])('refuses a wrong-type nested %s in a patch', (_field, input) => {
    // Act
    const result = productPatchSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
    expect(new Set(messagesOf(result))).toEqual(new Set([INVALID]));
  });
});

describe('custom attribute names', () => {
  it('compares names in one Unicode form, so an NFC and an NFD "Café" are the same name', () => {
    // Arrange
    const nfc = 'Café';
    const nfd = 'Café';
    const settings = {
      ...validSettings,
      customAttributes: [
        { name: nfc, value: 'a' },
        { name: nfd.toUpperCase(), value: 'b' },
      ],
    };

    // Act
    const result = productSettingsSchema.safeParse(settings);

    // Assert
    expect(result.success).toBe(false);
    expect(messagesOf(result)).toEqual([INVALID]);
  });
});

describe('product list skip', () => {
  it('accepts a skip up to the int column and refuses one above', () => {
    // Act
    const atCap = productListQuerySchema.safeParse({ skip: INT_COLUMN_MAX });
    const aboveCap = productListQuerySchema.safeParse({ skip: INT_COLUMN_MAX + 1 });

    // Assert
    expect(atCap.success).toBe(true);
    expect(aboveCap.success).toBe(false);
    expect(messagesOf(aboveCap)).toEqual([INVALID]);
  });
});

describe('catalog text', () => {
  it('refuses a lone surrogate in a title', () => {
    // Act
    const result = productInputSchema.safeParse({ ...validProduct, title: `Shoe${String.fromCharCode(0xd800)}` });

    // Assert
    expect(result.success).toBe(false);
    expect(messagesOf(result)).toEqual([INVALID]);
  });
});
