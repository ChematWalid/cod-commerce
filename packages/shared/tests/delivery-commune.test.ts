import { describe, expect, it } from 'vitest';
import {
  DELIVERY_PRICING_ERROR_CODES,
  FEE_GROUP_LIST_MAX_TAKE,
  FEE_GROUP_LIST_PAGE_SIZE,
  MAX_COMMUNE_RATES_PER_WILAYA,
  MAX_DELIVERY_PRICE,
  ONS_CODE_MAX,
  deliveryFeeCommuneRatesInputSchema,
  deliveryFeeGroupListQuerySchema,
  deliveryFeeRateSchema,
} from '../src/index';

const row = (codeOns: number, fields: Record<string, unknown> = {}) => ({
  codeOns,
  homePrice: 450,
  deskPrice: null,
  deliveryEnabled: true,
  deskEnabled: null,
  ...fields,
});

const communeIssuesOf = (input: unknown): string[] => {
  const result = deliveryFeeCommuneRatesInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('delivery-pricing constants of the commune layer and the list', () => {
  it('pins the commune and list bounds', () => {
    expect(MAX_COMMUNE_RATES_PER_WILAYA).toBe(100);
    expect(ONS_CODE_MAX).toBe(999_999);
    expect(FEE_GROUP_LIST_PAGE_SIZE).toBe(20);
    expect(FEE_GROUP_LIST_MAX_TAKE).toBe(100);
    expect(DELIVERY_PRICING_ERROR_CODES.CARRIER_NOT_FOUND).toBe('delivery-pricing.carrier-not-found');
  });
});

describe('deliveryFeeCommuneRatesInputSchema', () => {
  it('accepts the rows of one wilaya, a null meaning "inherit"', () => {
    // Act
    const parsed = deliveryFeeCommuneRatesInputSchema.parse({ provinceCode: '16', rows: [row(1601), row(1652)] });

    // Assert
    expect(parsed.rows[0]).toEqual(row(1601));
  });

  it('reads an absent price or switch as null', () => {
    // Act
    const parsed = deliveryFeeCommuneRatesInputSchema.parse({ provinceCode: '16', rows: [{ codeOns: 1601 }] });

    // Assert
    expect(parsed.rows[0]).toEqual({
      codeOns: 1601,
      homePrice: null,
      deskPrice: null,
      deliveryEnabled: null,
      deskEnabled: null,
    });
  });

  it('refuses a commune named twice', () => {
    expect(communeIssuesOf({ provinceCode: '16', rows: [row(1601), row(1601)] })).toContain(
      DELIVERY_PRICING_ERROR_CODES.INVALID_INPUT,
    );
  });

  it.each([0, -1, 1.5, ONS_CODE_MAX + 1])('refuses the ONS code %s', (codeOns) => {
    expect(communeIssuesOf({ provinceCode: '16', rows: [row(codeOns)] })).not.toEqual([]);
  });

  it('bounds the prices like a wilaya price', () => {
    expect(communeIssuesOf({ provinceCode: '16', rows: [row(1601, { homePrice: MAX_DELIVERY_PRICE })] })).toEqual([]);
    expect(communeIssuesOf({ provinceCode: '16', rows: [row(1601, { homePrice: -1 })] })).not.toEqual([]);
    expect(communeIssuesOf({ provinceCode: '16', rows: [row(1601, { deskPrice: 2.5 })] })).not.toEqual([]);
  });

  it('refuses an unknown wilaya and more rows than any wilaya has communes', () => {
    const many = Array.from({ length: MAX_COMMUNE_RATES_PER_WILAYA + 1 }, (_, index) => row(index + 1));

    expect(communeIssuesOf({ provinceCode: '70', rows: [] })).not.toEqual([]);
    expect(communeIssuesOf({ provinceCode: '16', rows: many })).not.toEqual([]);
  });
});

describe('deliveryFeeRateSchema', () => {
  it('requires the overridden flag on a stored wilaya row', () => {
    const stored = {
      provinceCode: '16',
      homePrice: 500,
      deskPrice: 400,
      deliveryEnabled: true,
      deskEnabled: true,
      baseHomePrice: 500,
      baseDeskPrice: 400,
    };

    expect(deliveryFeeRateSchema.safeParse(stored).success).toBe(false);
    expect(deliveryFeeRateSchema.parse({ ...stored, overridden: false }).overridden).toBe(false);
  });
});

describe('deliveryFeeGroupListQuerySchema', () => {
  it('pages from the start by default', () => {
    expect(deliveryFeeGroupListQuerySchema.parse(undefined)).toEqual({ skip: 0, take: FEE_GROUP_LIST_PAGE_SIZE });
  });

  it('reads a REST query string and drops a blank search', () => {
    expect(deliveryFeeGroupListQuerySchema.parse({ skip: '20', take: '10', search: '  ' })).toEqual({
      skip: 20,
      take: 10,
    });
    expect(deliveryFeeGroupListQuerySchema.parse({ search: ' Sud ', skip: null })).toEqual({
      skip: 0,
      take: FEE_GROUP_LIST_PAGE_SIZE,
      search: 'Sud',
    });
  });

  it('refuses a page larger than the cap or a negative skip', () => {
    expect(deliveryFeeGroupListQuerySchema.safeParse({ take: FEE_GROUP_LIST_MAX_TAKE + 1 }).success).toBe(false);
    expect(deliveryFeeGroupListQuerySchema.safeParse({ skip: -1 }).success).toBe(false);
  });
});
