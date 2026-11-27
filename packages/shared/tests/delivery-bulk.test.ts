import { describe, expect, it } from 'vitest';
import {
  DELIVERY_PRICING_ERROR_CODES,
  FEE_GROUP_NAME_MAX,
  MAX_ADJUST_PROVINCES,
  MAX_DELIVERY_PRICE,
  MAX_PRICE_ADJUST_PERCENT,
  MIN_PRICE_ADJUST_PERCENT,
  deliveryFeeCommunePricesInputSchema,
  deliveryFeeGroupDuplicateInputSchema,
  deliveryFeePriceAdjustmentInputSchema,
} from '../src/index';

const INVALID = DELIVERY_PRICING_ERROR_CODES.INVALID_INPUT;

const adjustment = (fields: Record<string, unknown> = {}) => ({
  provinceCodes: ['16', '31'],
  kind: 'percent',
  value: 10,
  home: true,
  desk: false,
  ...fields,
});

const issuesOf = (schema: { safeParse(input: unknown): { success: boolean; error?: unknown } }, input: unknown) => {
  const result = schema.safeParse(input);
  if (result.success) return [];
  return (result.error as { issues: { message: string }[] }).issues.map((issue) => issue.message);
};

describe('delivery-pricing bulk constants', () => {
  it('pins the bulk bounds', () => {
    expect(MAX_ADJUST_PROVINCES).toBe(100);
    expect(MIN_PRICE_ADJUST_PERCENT).toBe(-100);
    expect(MAX_PRICE_ADJUST_PERCENT).toBe(1000);
  });
});

describe('deliveryFeePriceAdjustmentInputSchema', () => {
  it('accepts a percent raise of the home price of two wilayas, communes left out by default', () => {
    // Act
    const parsed = deliveryFeePriceAdjustmentInputSchema.parse(adjustment());

    // Assert
    expect(parsed).toEqual({ ...adjustment(), includeCommunes: false });
  });

  it('accepts a DZD cut of both prices, communes included', () => {
    // Act
    const parsed = deliveryFeePriceAdjustmentInputSchema.parse(
      adjustment({ kind: 'amount', value: -150, desk: true, includeCommunes: true }),
    );

    // Assert
    expect(parsed).toMatchObject({ kind: 'amount', value: -150, home: true, desk: true, includeCommunes: true });
  });

  it.each([
    ['no wilaya', { provinceCodes: [] }],
    ['an unknown wilaya', { provinceCodes: ['99'] }],
    ['a wilaya named twice', { provinceCodes: ['16', '16'] }],
    ['more wilayas than the bound', { provinceCodes: Array.from({ length: MAX_ADJUST_PROVINCES + 1 }, () => '16') }],
    ['neither price', { home: false, desk: false }],
    ['an unknown kind', { kind: 'factor' }],
    ['a fractional value', { value: 2.5 }],
    ['a percent below -100', { value: MIN_PRICE_ADJUST_PERCENT - 1 }],
    ['a percent above the bound', { value: MAX_PRICE_ADJUST_PERCENT + 1 }],
    ['an amount above the price bound', { kind: 'amount', value: MAX_DELIVERY_PRICE + 1 }],
    ['an amount below minus the price bound', { kind: 'amount', value: -MAX_DELIVERY_PRICE - 1 }],
    ['a text value', { value: '10' }],
  ])('refuses %s with the one invalid-input code', (_label, fields) => {
    // Act
    const issues = issuesOf(deliveryFeePriceAdjustmentInputSchema, adjustment(fields));

    // Assert
    expect(issues.length).toBeGreaterThan(0);
    expect(new Set(issues)).toEqual(new Set([INVALID]));
  });

  it('accepts the extreme values of each kind', () => {
    // Act
    const outcomes = [
      adjustment({ value: MIN_PRICE_ADJUST_PERCENT }),
      adjustment({ value: MAX_PRICE_ADJUST_PERCENT }),
      adjustment({ kind: 'amount', value: MAX_DELIVERY_PRICE }),
      adjustment({ kind: 'amount', value: -MAX_DELIVERY_PRICE }),
    ].map((input) => deliveryFeePriceAdjustmentInputSchema.safeParse(input).success);

    // Assert
    expect(outcomes).toEqual([true, true, true, true]);
  });
});

describe('deliveryFeeCommunePricesInputSchema', () => {
  it('keeps an absent price absent (left as stored) and a null price null (cleared)', () => {
    // Act
    const parsed = deliveryFeeCommunePricesInputSchema.parse({ provinceCode: '16', prices: { homePrice: null } });

    // Assert
    expect(parsed).toEqual({ provinceCode: '16', prices: { homePrice: null } });
    expect('deskPrice' in parsed.prices).toBe(false);
  });

  it('accepts both prices', () => {
    // Act
    const parsed = deliveryFeeCommunePricesInputSchema.parse({
      provinceCode: '16',
      prices: { homePrice: 450, deskPrice: 300 },
    });

    // Assert
    expect(parsed.prices).toEqual({ homePrice: 450, deskPrice: 300 });
  });

  it.each([
    ['no price at all', { provinceCode: '16', prices: {} }],
    ['an unknown wilaya', { provinceCode: '99', prices: { homePrice: 450 } }],
    ['a negative price', { provinceCode: '16', prices: { homePrice: -1 } }],
    ['a price above the bound', { provinceCode: '16', prices: { deskPrice: MAX_DELIVERY_PRICE + 1 } }],
    ['no prices object', { provinceCode: '16' }],
  ])('refuses %s with the one invalid-input code', (_label, input) => {
    // Act
    const issues = issuesOf(deliveryFeeCommunePricesInputSchema, input);

    // Assert
    expect(issues.length).toBeGreaterThan(0);
    expect(new Set(issues)).toEqual(new Set([INVALID]));
  });
});

describe('deliveryFeeGroupDuplicateInputSchema', () => {
  it('trims the name of the copy', () => {
    expect(deliveryFeeGroupDuplicateInputSchema.parse({ name: '  Copy of Standard ' })).toEqual({
      name: 'Copy of Standard',
    });
  });

  it.each([
    ['a blank name', '   '],
    ['a name above the bound', 'x'.repeat(FEE_GROUP_NAME_MAX + 1)],
    ['a name with a control character', 'Copy\u0007'],
    ['a missing name', undefined],
  ])('refuses %s', (_label, name) => {
    expect(issuesOf(deliveryFeeGroupDuplicateInputSchema, { name })).toEqual([INVALID]);
  });
});
