import { describe, expect, it } from 'vitest';
import {
  CATALOG_PACKS_ERROR_CODES,
  PACK_DISCOUNT_TYPES,
  PACK_MAX_COMPONENTS,
  PACK_MAX_QUANTITY,
  PACK_MIN_COMPONENTS,
  PACK_PRICING_MODES,
  PACK_SHARED_OPTION_MAX,
  PACK_VARIANT_MODES,
  PACK_WEIGHT_MODES,
  packInputSchema,
  type PackInput,
} from '../../src/index';

const pinnedComponent = { productId: '12', variantId: '120', quantity: 2 };
const twoComponents = [{ productId: '11', quantity: 1 }, pinnedComponent];

/** A valid pack: components summed with a 10 % discount, one default variant, weight summed. */
function pack(overrides: Partial<PackInput> = {}): PackInput {
  return {
    packPricingMode: 'components_sum',
    packDiscountType: 'percent',
    packDiscountValue: 10,
    packVariantMode: 'per_component',
    packWeightMode: 'components_sum',
    components: twoComponents,
    ...overrides,
  };
}

const componentsOf = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ productId: String(index + 1), quantity: 1 }));

describe('pack constants (D2202)', () => {
  it('names the modes and bounds of a pack', () => {
    expect(PACK_PRICING_MODES).toEqual(['fixed', 'components_sum']);
    expect(PACK_DISCOUNT_TYPES).toEqual(['percent', 'amount']);
    expect(PACK_VARIANT_MODES).toEqual(['per_component', 'shared_option']);
    expect(PACK_WEIGHT_MODES).toEqual(['components_sum', 'fixed']);
    expect([PACK_MIN_COMPONENTS, PACK_MAX_COMPONENTS, PACK_MAX_QUANTITY, PACK_SHARED_OPTION_MAX]).toEqual([
      2, 10, 99, 50,
    ]);
  });

  it('prefixes every error code with packs.', () => {
    const codes = Object.values(CATALOG_PACKS_ERROR_CODES);

    for (const code of codes) expect(code).toMatch(/^packs\.[a-z]+(-[a-z]+)*$/);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('packInputSchema', () => {
  it('accepts a components-sum pack with a percent discount', () => {
    expect(packInputSchema.safeParse(pack()).success).toBe(true);
  });

  it('accepts a fixed-price pack with a fixed weight', () => {
    // Arrange
    const input = pack({
      packPricingMode: 'fixed',
      packFixedPrice: 4500,
      packDiscountType: null,
      packDiscountValue: null,
      packWeightMode: 'fixed',
      packFixedWeightGrams: 800,
    });

    // Act and assert
    expect(packInputSchema.safeParse(input).success).toBe(true);
  });

  it('refuses a discount with fixed pricing', () => {
    expect(packInputSchema.safeParse(pack({ packPricingMode: 'fixed', packFixedPrice: 4500 })).success).toBe(false);
  });

  it('refuses a fixed pricing without a fixed price', () => {
    const input = pack({ packPricingMode: 'fixed', packDiscountType: null, packDiscountValue: null });

    expect(packInputSchema.safeParse(input).success).toBe(false);
  });

  it('refuses a discount type without a value', () => {
    expect(packInputSchema.safeParse(pack({ packDiscountValue: null })).success).toBe(false);
  });

  it('refuses 1 and 11 components', () => {
    expect(packInputSchema.safeParse(pack({ components: componentsOf(1) })).success).toBe(false);
    expect(packInputSchema.safeParse(pack({ components: componentsOf(11) })).success).toBe(false);
    expect(packInputSchema.safeParse(pack({ components: componentsOf(10) })).success).toBe(true);
  });

  it('refuses a quantity of 0 or 100', () => {
    for (const quantity of [0, 100]) {
      const components = [{ productId: '11', quantity }, pinnedComponent];

      expect(packInputSchema.safeParse(pack({ components })).success).toBe(false);
    }
  });

  it('refuses percent 101', () => {
    expect(packInputSchema.safeParse(pack({ packDiscountValue: 101 })).success).toBe(false);
    expect(packInputSchema.safeParse(pack({ packDiscountValue: 100 })).success).toBe(true);
  });

  it('takes an amount discount in whole DZD', () => {
    expect(packInputSchema.safeParse(pack({ packDiscountType: 'amount', packDiscountValue: 500 })).success).toBe(true);
    expect(packInputSchema.safeParse(pack({ packDiscountType: 'amount', packDiscountValue: 1.5 })).success).toBe(false);
    expect(packInputSchema.safeParse(pack({ packDiscountType: 'amount', packDiscountValue: -1 })).success).toBe(false);
  });

  it('requires the shared option name in shared mode', () => {
    // Arrange
    const components = componentsOf(2);

    // Act and assert
    expect(packInputSchema.safeParse(pack({ packVariantMode: 'shared_option', components })).success).toBe(false);
    expect(
      packInputSchema.safeParse(pack({ packVariantMode: 'shared_option', packSharedOption: 'Size', components }))
        .success,
    ).toBe(true);
    expect(
      packInputSchema.safeParse(
        pack({ packVariantMode: 'shared_option', packSharedOption: 'x'.repeat(51), components }),
      ).success,
    ).toBe(false);
  });

  it('refuses a pinned variant in shared mode, where the shared value picks it', () => {
    const input = pack({ packVariantMode: 'shared_option', packSharedOption: 'Size' });

    expect(packInputSchema.safeParse(input).success).toBe(false);
  });

  it('refuses a shared option name in per-component mode', () => {
    expect(packInputSchema.safeParse(pack({ packSharedOption: 'Size' })).success).toBe(false);
  });

  it('requires a fixed weight only in fixed weight mode', () => {
    expect(packInputSchema.safeParse(pack({ packWeightMode: 'fixed' })).success).toBe(false);
    expect(packInputSchema.safeParse(pack({ packFixedWeightGrams: 800 })).success).toBe(false);
  });

  it('refuses a repeated product and variant', () => {
    // Arrange: "07" and "7" name the same Vendure product.
    const sameProduct = [
      { productId: '7', quantity: 1 },
      { productId: '07', quantity: 2 },
    ];
    const sameVariant = [
      { productId: '7', variantId: '70', quantity: 1 },
      { productId: '7', variantId: '070', quantity: 1 },
    ];
    const twoVariants = [
      { productId: '7', variantId: '70', quantity: 1 },
      { productId: '7', variantId: '71', quantity: 1 },
    ];

    // Act and assert
    expect(packInputSchema.safeParse(pack({ components: sameProduct })).success).toBe(false);
    expect(packInputSchema.safeParse(pack({ components: sameVariant })).success).toBe(false);
    expect(packInputSchema.safeParse(pack({ components: twoVariants })).success).toBe(true);
  });
});
