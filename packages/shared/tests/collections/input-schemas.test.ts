import { describe, expect, it } from 'vitest';
import {
  COLLECTION_DESCRIPTION_MAX,
  COLLECTION_MAX_MANUAL_PRODUCTS,
  COLLECTION_POSITION_MAX,
  COLLECTION_PREVIEW_MAX_TAKE,
  COLLECTION_TITLE_MAX,
  COLLECTIONS_ERROR_CODES,
  collectionChangedPayloadSchema,
  createStoreCollectionInputSchema,
  previewStoreCollectionInputSchema,
  setStoreCollectionProductsInputSchema,
  setStoreProductCollectionsInputSchema,
  storeCollectionListQuerySchema,
  updateStoreCollectionInputSchema,
} from '../../src/index';

const RULE = { version: 1, match: 'any', conditions: [{ field: 'on_sale', operator: 'is', value: true }] };
const MANUAL = { title: 'Summer', visible: true, position: 0, mode: 'manual' };
const AUTOMATIC = { ...MANUAL, mode: 'automatic', rule: RULE };
const STORE_ID = '1200000000000000007';

/** `count` distinct product ids. */
const idsOf = (count: number): string[] => Array.from({ length: count }, (_unused, index) => String(index + 1));

/** The issue messages of a refused parse. */
function refusalOf(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  expect(result.success).toBe(false);
  return result.error?.issues.map(({ message }) => message) ?? [];
}

describe('createStoreCollectionInputSchema', () => {
  it('accepts a manual and an automatic collection', () => {
    expect(createStoreCollectionInputSchema.parse(MANUAL)).toEqual(MANUAL);
    expect(createStoreCollectionInputSchema.parse(AUTOMATIC)).toEqual(AUTOMATIC);
  });

  it('requires a rule for automatic mode and refuses one for manual mode', () => {
    const automaticWithoutRule = { ...MANUAL, mode: 'automatic' };

    expect(refusalOf(createStoreCollectionInputSchema.safeParse(automaticWithoutRule))).toContain(
      COLLECTIONS_ERROR_CODES.RULE_INVALID,
    );
    expect(refusalOf(createStoreCollectionInputSchema.safeParse({ ...MANUAL, rule: RULE }))).toContain(
      COLLECTIONS_ERROR_CODES.INVALID_INPUT,
    );
  });

  it('refuses an invalid rule with the rule code', () => {
    const messages = refusalOf(
      createStoreCollectionInputSchema.safeParse({ ...AUTOMATIC, rule: { ...RULE, version: 9 } }),
    );

    expect(messages).toEqual([COLLECTIONS_ERROR_CODES.RULE_INVALID]);
  });

  it(`refuses position ${String(COLLECTION_POSITION_MAX + 1)}, a negative or a fractional position`, () => {
    for (const position of [COLLECTION_POSITION_MAX + 1, -1, 1.5]) {
      expect(refusalOf(createStoreCollectionInputSchema.safeParse({ ...MANUAL, position }))).toEqual([
        COLLECTIONS_ERROR_CODES.INVALID_INPUT,
      ]);
    }
    expect(createStoreCollectionInputSchema.safeParse({ ...MANUAL, position: COLLECTION_POSITION_MAX }).success).toBe(
      true,
    );
  });

  it('refuses an empty or too long title and a too long description', () => {
    expect(refusalOf(createStoreCollectionInputSchema.safeParse({ ...MANUAL, title: '  ' }))).toEqual([
      COLLECTIONS_ERROR_CODES.INVALID_INPUT,
    ]);
    expect(
      createStoreCollectionInputSchema.safeParse({ ...MANUAL, title: 'a'.repeat(COLLECTION_TITLE_MAX + 1) }).success,
    ).toBe(false);
    expect(
      createStoreCollectionInputSchema.safeParse({
        ...MANUAL,
        description: 'a'.repeat(COLLECTION_DESCRIPTION_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it('keeps a multi-line description and reads a blank slug as no slug', () => {
    const parsed = createStoreCollectionInputSchema.parse({ ...MANUAL, description: '<p>a</p>\n<p>b</p>', slug: ' ' });

    expect(parsed.description).toBe('<p>a</p>\n<p>b</p>');
    expect(parsed.slug).toBeUndefined();
  });

  it('refuses an object that is no object and an unknown mode', () => {
    expect(refusalOf(createStoreCollectionInputSchema.safeParse(null))).toEqual([
      COLLECTIONS_ERROR_CODES.INVALID_INPUT,
    ]);
    expect(createStoreCollectionInputSchema.safeParse({ ...MANUAL, mode: 'smart' }).success).toBe(false);
  });
});

describe('updateStoreCollectionInputSchema', () => {
  it('accepts any single field and an empty patch', () => {
    expect(updateStoreCollectionInputSchema.parse({})).toEqual({});
    expect(updateStoreCollectionInputSchema.parse({ visible: false })).toEqual({ visible: false });
    expect(updateStoreCollectionInputSchema.parse({ rule: RULE })).toEqual({ rule: RULE });
    expect(updateStoreCollectionInputSchema.parse({ featuredAssetId: null })).toEqual({ featuredAssetId: null });
  });

  it('couples the rule with the mode when the mode is sent', () => {
    expect(updateStoreCollectionInputSchema.safeParse({ mode: 'automatic' }).success).toBe(false);
    expect(updateStoreCollectionInputSchema.safeParse({ mode: 'manual', rule: RULE }).success).toBe(false);
    expect(updateStoreCollectionInputSchema.safeParse({ mode: 'automatic', rule: RULE }).success).toBe(true);
    expect(updateStoreCollectionInputSchema.safeParse({ mode: 'manual' }).success).toBe(true);
  });
});

describe('setStoreCollectionProductsInputSchema', () => {
  it('accepts an empty list and the cap', () => {
    expect(setStoreCollectionProductsInputSchema.parse({ productIds: [] })).toEqual({ productIds: [] });
    expect(
      setStoreCollectionProductsInputSchema.safeParse({ productIds: idsOf(COLLECTION_MAX_MANUAL_PRODUCTS) }).success,
    ).toBe(true);
  });

  it('refuses duplicate product ids', () => {
    expect(refusalOf(setStoreCollectionProductsInputSchema.safeParse({ productIds: ['7', '7'] }))).toEqual([
      COLLECTIONS_ERROR_CODES.INVALID_INPUT,
    ]);
    expect(setStoreCollectionProductsInputSchema.safeParse({ productIds: ['7', '07'] }).success).toBe(false);
  });

  it(`refuses ${String(COLLECTION_MAX_MANUAL_PRODUCTS + 1)} product ids`, () => {
    expect(
      refusalOf(
        setStoreCollectionProductsInputSchema.safeParse({ productIds: idsOf(COLLECTION_MAX_MANUAL_PRODUCTS + 1) }),
      ),
    ).toEqual([COLLECTIONS_ERROR_CODES.TOO_MANY_PRODUCTS]);
  });

  it('turns GraphQL numbers into strings and refuses an unsafe number', () => {
    expect(setStoreCollectionProductsInputSchema.parse({ productIds: [7] })).toEqual({ productIds: ['7'] });
    expect(setStoreCollectionProductsInputSchema.safeParse({ productIds: [2 ** 60] }).success).toBe(false);
  });
});

describe('setStoreProductCollectionsInputSchema', () => {
  it('accepts a product and its collections and refuses duplicates', () => {
    expect(setStoreProductCollectionsInputSchema.parse({ productId: '3', collectionIds: ['1', '2'] })).toEqual({
      productId: '3',
      collectionIds: ['1', '2'],
    });
    expect(setStoreProductCollectionsInputSchema.safeParse({ productId: '3', collectionIds: ['1', '1'] }).success).toBe(
      false,
    );
    expect(setStoreProductCollectionsInputSchema.safeParse({ collectionIds: [] }).success).toBe(false);
  });
});

describe('previewStoreCollectionInputSchema', () => {
  it(`refuses preview take ${String(COLLECTION_PREVIEW_MAX_TAKE + 1)}`, () => {
    expect(
      refusalOf(
        previewStoreCollectionInputSchema.safeParse({ rule: RULE, skip: 0, take: COLLECTION_PREVIEW_MAX_TAKE + 1 }),
      ),
    ).toEqual([COLLECTIONS_ERROR_CODES.INVALID_INPUT]);
  });

  it('defaults the page and keeps the rule', () => {
    expect(previewStoreCollectionInputSchema.parse({ rule: RULE })).toEqual({
      rule: RULE,
      skip: 0,
      take: COLLECTION_PREVIEW_MAX_TAKE,
    });
  });
});

describe('storeCollectionListQuerySchema', () => {
  it('reads a REST query string and drops unset fields', () => {
    expect(storeCollectionListQuerySchema.parse({ skip: '20', take: '10', search: null })).toEqual({
      skip: 20,
      take: 10,
    });
    expect(storeCollectionListQuerySchema.parse({ search: '  ' })).toEqual({ skip: 0, take: 20 });
    expect(storeCollectionListQuerySchema.parse({ search: ' Summer ' })).toEqual({
      skip: 0,
      take: 20,
      search: 'Summer',
    });
  });

  it('refuses take 101 and a search with a control character', () => {
    expect(storeCollectionListQuerySchema.safeParse({ take: 101 }).success).toBe(false);
    expect(storeCollectionListQuerySchema.safeParse({ search: `a${String.fromCodePoint(0)}` }).success).toBe(false);
  });
});

describe('collectionChangedPayloadSchema', () => {
  it('accepts ids and a change kind only', () => {
    const payload = { collectionId: '12', storeId: STORE_ID, change: 'membership' };

    expect(collectionChangedPayloadSchema.parse(payload)).toEqual(payload);
  });

  it('refuses a malformed id or an unknown change', () => {
    expect(
      collectionChangedPayloadSchema.safeParse({ collectionId: 'x', storeId: STORE_ID, change: 'created' }).success,
    ).toBe(false);
    expect(
      collectionChangedPayloadSchema.safeParse({ collectionId: '1', storeId: '-1', change: 'created' }).success,
    ).toBe(false);
    expect(
      collectionChangedPayloadSchema.safeParse({ collectionId: '1', storeId: STORE_ID, change: 'moved' }).success,
    ).toBe(false);
  });
});
