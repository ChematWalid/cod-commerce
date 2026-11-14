import { describe, expect, it } from 'vitest';
import {
  CATALOG_ERROR_CODES,
  CATALOG_MAX_PAGE_SIZE,
  CATALOG_PAGE_SIZE,
  CATALOG_WARNING_CODES,
  LOGO_MAX_BYTES,
  MAX_OPTION_GROUPS,
  MAX_OPTION_VALUES,
  MAX_PRODUCT_HIGHLIGHTS,
  MAX_VARIANTS,
  MEDIA_IMAGE_MIME_TYPES,
  MEDIA_MAX_BYTES,
  MONEY_MAX_DZD,
  OPTION_VALUE_SEPARATOR,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  SKU_SUFFIX_SEPARATOR,
  VARIANT_NAME_SEPARATOR,
} from '../../src/index';

describe('catalog constants', () => {
  it('knows the three product statuses and the physical type', () => {
    expect(PRODUCT_STATUSES).toEqual(['active', 'hidden', 'draft']);
    expect(PRODUCT_TYPES).toEqual(['physical']);
  });

  it('caps highlights at six and the matrix at three options of twenty values and 100 variants', () => {
    expect(MAX_PRODUCT_HIGHLIGHTS).toBe(6);
    expect([MAX_OPTION_GROUPS, MAX_OPTION_VALUES, MAX_VARIANTS]).toEqual([3, 20, 100]);
  });

  it('takes media up to the logo size, images only and never SVG', () => {
    expect(MEDIA_MAX_BYTES).toBe(LOGO_MAX_BYTES);
    expect(MEDIA_MAX_BYTES).toBe(5_242_880);
    expect(MEDIA_IMAGE_MIME_TYPES).toEqual(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
  });

  it('names variants "Product - Red / S" with skus <sku>-n', () => {
    expect(VARIANT_NAME_SEPARATOR).toBe(' - ');
    expect(OPTION_VALUE_SEPARATOR).toBe(' / ');
    expect(SKU_SUFFIX_SEPARATOR).toBe('-');
  });

  it('bounds money by the int column and pages by 20 up to 100', () => {
    expect(MONEY_MAX_DZD).toBe(2_147_483_647);
    expect([CATALOG_PAGE_SIZE, CATALOG_MAX_PAGE_SIZE]).toEqual([20, 100]);
  });

  it('prefixes every error and warning code with catalog.', () => {
    const codes = [...Object.values(CATALOG_ERROR_CODES), ...Object.values(CATALOG_WARNING_CODES)];

    for (const code of codes) expect(code).toMatch(/^catalog\.[a-z]+(-[a-z]+)*$/);
    expect(new Set(codes).size).toBe(codes.length);
    expect(CATALOG_WARNING_CODES.oldPriceBelowPrice).toBe('catalog.old-price-below-price');
  });

  it('has a code for every refusal the catalog API names', () => {
    expect(Object.values(CATALOG_ERROR_CODES).sort()).toEqual(
      [
        'catalog.product-not-found',
        'catalog.invalid-input',
        'catalog.too-many-highlights',
        'catalog.matrix-too-large',
        'catalog.duplicate-option-value',
        'catalog.duplicate-option-name',
        'catalog.brand-not-found',
        'catalog.tag-not-found',
        'catalog.highlight-not-found',
        'catalog.media-not-found',
        'catalog.media-too-large',
        'catalog.media-type',
        'catalog.media-in-use',
        'catalog.order-manager-unknown',
        'catalog.order-managers-unavailable',
        'catalog.name-taken',
        'catalog.concurrent-update',
      ].sort(),
    );
  });
});
