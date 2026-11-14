import { describe, expect, it } from 'vitest';
import {
  brandInputSchema,
  CATALOG_ERROR_CODES,
  CATALOG_MAX_PAGE_SIZE,
  catalogTextSchema,
  CUSTOM_ATTRIBUTE_NAME_MAX,
  CUSTOM_ATTRIBUTE_VALUE_MAX,
  highlightInputSchema,
  MAX_OPTION_GROUPS,
  MAX_OPTION_VALUES,
  MAX_PRODUCT_ASSETS,
  MAX_PRODUCT_COLLECTIONS,
  MAX_PRODUCT_HIGHLIGHTS,
  MAX_PRODUCT_TAGS,
  MAX_VARIANTS,
  moneySchema,
  MONEY_MAX_DZD,
  productInputSchema,
  productPatchSchema,
  productSettingsSchema,
  soldOutOrdersInputSchema,
  tagInputSchema,
} from '../../src/index';

const NUL = String.fromCodePoint(0);
const RLO = String.fromCodePoint(0x202e);

const validProduct = { title: 'Red shoe', status: 'active', type: 'physical', price: 2500 };
const validSettings = {
  isFragile: false,
  allowParcelOpening: true,
  allowOutOfStockOrders: true,
  soldOut: false,
  quantityRules: { enabled: true, min: 1, step: 1 },
};

/** `count` distinct snowflake ids. */
function idsOf(count: number): string[] {
  return Array.from({ length: count }, (_unused, index) => String(1_000_000_000_000n + BigInt(index)));
}

function messagesOf(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('productInputSchema', () => {
  it('accepts a minimal product and fills empty lists', () => {
    const parsed = productInputSchema.parse(validProduct);

    expect(parsed).toMatchObject({ ...validProduct, assetIds: [], tagIds: [], highlightIds: [], optionGroups: [] });
  });

  it('trims the title and accepts Arabic text with direction marks', () => {
    const title = '‏حذاء رياضي أحمر';

    expect(productInputSchema.parse({ ...validProduct, title: `  ${title} ` }).title).toBe(title);
  });

  it('refuses a seventh highlight', () => {
    const result = productInputSchema.safeParse({ ...validProduct, highlightIds: idsOf(MAX_PRODUCT_HIGHLIGHTS + 1) });

    expect(result.success).toBe(false);
    expect(messagesOf(result)).toContain(CATALOG_ERROR_CODES.TOO_MANY_HIGHLIGHTS);
    expect(productInputSchema.safeParse({ ...validProduct, highlightIds: idsOf(6) }).success).toBe(true);
  });

  it.each([
    ['title', { title: `Shoe${NUL}` }],
    ['sku', { sku: `SKU${NUL}1` }],
    ['slug', { slug: `shoe${NUL}` }],
  ])('refuses a NUL in a %s', (_field, patch) => {
    expect(productInputSchema.safeParse({ ...validProduct, ...patch }).success).toBe(false);
  });

  it('refuses a bidi override in a title', () => {
    expect(productInputSchema.safeParse({ ...validProduct, title: `Invoice${RLO}fdp.exe` }).success).toBe(false);
  });

  it.each([-1, 1.5, Number.NaN])('refuses a negative or fractional price (%s)', (price) => {
    expect(productInputSchema.safeParse({ ...validProduct, price }).success).toBe(false);
  });

  it('refuses a price above the int column', () => {
    expect(moneySchema.safeParse(MONEY_MAX_DZD).success).toBe(true);
    expect(productInputSchema.safeParse({ ...validProduct, price: MONEY_MAX_DZD + 1 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...validProduct, oldPrice: MONEY_MAX_DZD + 1 }).success).toBe(false);
  });

  it('refuses a fourth option group', () => {
    const groups = (count: number) =>
      Array.from({ length: count }, (_u, i) => ({ name: `G${String(i)}`, values: ['a'] }));

    expect(productInputSchema.safeParse({ ...validProduct, optionGroups: groups(MAX_OPTION_GROUPS) }).success).toBe(
      true,
    );
    const result = productInputSchema.safeParse({ ...validProduct, optionGroups: groups(MAX_OPTION_GROUPS + 1) });
    expect(messagesOf(result)).toContain(CATALOG_ERROR_CODES.MATRIX_TOO_LARGE);
  });

  it('refuses more values in one option than the cap', () => {
    const values = Array.from({ length: MAX_OPTION_VALUES + 1 }, (_u, i) => `v${String(i)}`);
    const result = productInputSchema.safeParse({ ...validProduct, optionGroups: [{ name: 'Size', values }] });

    expect(messagesOf(result)).toContain(CATALOG_ERROR_CODES.MATRIX_TOO_LARGE);
  });

  it.each([
    ['assets', 'assetIds', MAX_PRODUCT_ASSETS],
    ['tags', 'tagIds', MAX_PRODUCT_TAGS],
    ['collections', 'collectionIds', MAX_PRODUCT_COLLECTIONS],
  ])('refuses more than the cap of %s', (_name, field, cap) => {
    expect(productInputSchema.safeParse({ ...validProduct, [field]: idsOf(cap) }).success).toBe(true);
    expect(productInputSchema.safeParse({ ...validProduct, [field]: idsOf(cap + 1) }).success).toBe(false);
  });

  it('refuses the same id twice in a link list', () => {
    expect(productInputSchema.safeParse({ ...validProduct, tagIds: ['1000000000001', '1000000000001'] }).success).toBe(
      false,
    );
  });

  it('leaves the shape of a referenced id to the API boundary, which answers not found', () => {
    // D2136: a malformed id is "not found", not "invalid input"; the schema only bounds its length.
    expect(productInputSchema.safeParse({ ...validProduct, brandId: 'abc' }).success).toBe(true);
    expect(productInputSchema.safeParse({ ...validProduct, brandId: '9'.repeat(100) }).success).toBe(false);
  });
});

describe('productPatchSchema', () => {
  it('accepts an empty patch and a cleared old price', () => {
    expect(productPatchSchema.parse({})).toEqual({});
    expect(productPatchSchema.parse({ oldPrice: null })).toEqual({ oldPrice: null });
  });

  it('refuses more than the cap of patched variants', () => {
    const variants = (count: number) => Array.from({ length: count }, (_u, i) => ({ id: String(i + 1), price: 10 }));

    expect(productPatchSchema.safeParse({ variants: variants(MAX_VARIANTS) }).success).toBe(true);
    expect(productPatchSchema.safeParse({ variants: variants(MAX_VARIANTS + 1) }).success).toBe(false);
  });

  it('refuses a negative variant price and a NUL in a variant sku', () => {
    expect(productPatchSchema.safeParse({ variants: [{ id: '1', price: -1 }] }).success).toBe(false);
    expect(productPatchSchema.safeParse({ variants: [{ id: '1', sku: `A${NUL}` }] }).success).toBe(false);
  });

  it('refuses a seventh highlight on a patch too', () => {
    const result = productPatchSchema.safeParse({ highlightIds: idsOf(MAX_PRODUCT_HIGHLIGHTS + 1) });

    expect(messagesOf(result)).toContain(CATALOG_ERROR_CODES.TOO_MANY_HIGHLIGHTS);
  });
});

describe('productSettingsSchema', () => {
  it('accepts the settings and defaults the lists to empty', () => {
    expect(productSettingsSchema.parse(validSettings)).toMatchObject({ orderManagerIds: [], customAttributes: [] });
  });

  it('refuses a quantity step of 0', () => {
    const quantityRules = { enabled: true, min: 1, step: 0 };

    expect(productSettingsSchema.safeParse({ ...validSettings, quantityRules }).success).toBe(false);
  });

  it('refuses a minimum quantity of 0', () => {
    const quantityRules = { enabled: true, min: 0, step: 1 };

    expect(productSettingsSchema.safeParse({ ...validSettings, quantityRules }).success).toBe(false);
  });

  it('refuses duplicate order manager ids', () => {
    const orderManagerIds = ['1000000000001', '1000000000001'];

    expect(productSettingsSchema.safeParse({ ...validSettings, orderManagerIds }).success).toBe(false);
  });

  it('refuses an order manager id that is not a snowflake and more than twenty of them', () => {
    expect(productSettingsSchema.safeParse({ ...validSettings, orderManagerIds: ['-1'] }).success).toBe(false);
    expect(productSettingsSchema.safeParse({ ...validSettings, orderManagerIds: idsOf(21) }).success).toBe(false);
    expect(productSettingsSchema.safeParse({ ...validSettings, orderManagerIds: idsOf(20) }).success).toBe(true);
  });

  it('refuses an over-long custom attribute name or value', () => {
    const attribute = (name: string, value: string) => ({ ...validSettings, customAttributes: [{ name, value }] });

    expect(productSettingsSchema.safeParse(attribute('a'.repeat(CUSTOM_ATTRIBUTE_NAME_MAX), 'v')).success).toBe(true);
    expect(productSettingsSchema.safeParse(attribute('a'.repeat(CUSTOM_ATTRIBUTE_NAME_MAX + 1), 'v')).success).toBe(
      false,
    );
    expect(productSettingsSchema.safeParse(attribute('n', 'v'.repeat(CUSTOM_ATTRIBUTE_VALUE_MAX + 1))).success).toBe(
      false,
    );
  });

  it('refuses more than twenty custom attributes', () => {
    const customAttributes = Array.from({ length: 21 }, (_u, i) => ({ name: `n${String(i)}`, value: 'v' }));

    expect(productSettingsSchema.safeParse({ ...validSettings, customAttributes }).success).toBe(false);
  });
});

describe('taxonomy and sold-out inputs', () => {
  it('refuses a blank or control-character brand, tag or highlight', () => {
    expect(brandInputSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(tagInputSchema.safeParse({ name: `new${NUL}` }).success).toBe(false);
    expect(highlightInputSchema.safeParse({ text: 'Free delivery' }).success).toBe(true);
  });

  it('refuses more than the cap of sold-out product ids and takes an empty, absent or null list as all', () => {
    expect(soldOutOrdersInputSchema.parse({})).toEqual({ productIds: [] });
    expect(soldOutOrdersInputSchema.parse({ productIds: null })).toEqual({ productIds: [] });
    expect(soldOutOrdersInputSchema.safeParse({ productIds: idsOf(CATALOG_MAX_PAGE_SIZE) }).success).toBe(true);
    expect(soldOutOrdersInputSchema.safeParse({ productIds: idsOf(CATALOG_MAX_PAGE_SIZE + 1) }).success).toBe(false);
  });

  it('bounds a catalog text by its maximum length', () => {
    expect(catalogTextSchema(3).safeParse('abc').success).toBe(true);
    expect(catalogTextSchema(3).safeParse('abcd').success).toBe(false);
  });
});
