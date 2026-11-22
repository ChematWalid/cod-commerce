import { describe, expect, it } from 'vitest';
import {
  DELIVERY_PRICING_ERROR_CODES,
  DELIVERY_SPEEDS,
  FEE_GROUP_NAME_MAX,
  MAX_DELIVERY_PRICE,
  MAX_OVERWEIGHT_ALLOWANCE_KG,
  MAX_OVERWEIGHT_RATE,
  WILAYA_CODES,
  deliveryFeeGroupInputSchema,
  deliveryFeeGroupSchema,
  shippingQuoteSchema,
} from '../src/index';

const rateOf = (provinceCode: string) => ({
  provinceCode,
  homePrice: 600,
  deskPrice: 400,
  deliveryEnabled: true,
  deskEnabled: true,
});

const allRates = () => WILAYA_CODES.map(rateOf);

const validInput = () => ({
  name: 'Standard',
  carrierId: null,
  chargeOverweight: true,
  overweightAllowanceKg: 5,
  overweightRate: 50,
  rates: allRates(),
});

const issuesOf = (input: unknown): string[] => {
  const result = deliveryFeeGroupInputSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('constants', () => {
  it('pins the bounds of a fee group', () => {
    expect(FEE_GROUP_NAME_MAX).toBe(80);
    expect(MAX_DELIVERY_PRICE).toBe(100_000);
    expect(MAX_OVERWEIGHT_ALLOWANCE_KG).toBe(100);
    expect(MAX_OVERWEIGHT_RATE).toBe(10_000);
    expect(DELIVERY_SPEEDS).toEqual(['standard']);
  });
});

describe('deliveryFeeGroupInputSchema', () => {
  it('accepts a group with one rate for each of the 58 wilayas', () => {
    const parsed = deliveryFeeGroupInputSchema.parse(validInput());

    expect(parsed.rates).toHaveLength(58);
    expect(parsed.carrierId).toBeNull();
  });

  it('trims the name and refuses a blank or too long one', () => {
    expect(deliveryFeeGroupInputSchema.parse({ ...validInput(), name: '  Express  ' }).name).toBe('Express');
    expect(issuesOf({ ...validInput(), name: '   ' })).toContain(DELIVERY_PRICING_ERROR_CODES.INVALID_INPUT);
    expect(issuesOf({ ...validInput(), name: 'x'.repeat(FEE_GROUP_NAME_MAX + 1) })).not.toEqual([]);
    expect(issuesOf({ ...validInput(), name: 'x'.repeat(FEE_GROUP_NAME_MAX) })).toEqual([]);
  });

  it('refuses a name with a control character', () => {
    expect(issuesOf({ ...validInput(), name: 'Std\u0000' })).not.toEqual([]);
  });

  it.each([-1, 1.5, MAX_DELIVERY_PRICE + 1])('refuses the price %d', (price) => {
    const rates = allRates().map((rate, index) => (index === 0 ? { ...rate, homePrice: price } : rate));

    expect(issuesOf({ ...validInput(), rates })).not.toEqual([]);
  });

  it('accepts the price bounds 0 and MAX_DELIVERY_PRICE', () => {
    const rates = allRates().map((rate) => ({ ...rate, homePrice: 0, deskPrice: MAX_DELIVERY_PRICE }));

    expect(issuesOf({ ...validInput(), rates })).toEqual([]);
  });

  it('refuses fewer or more than 58 rates', () => {
    expect(issuesOf({ ...validInput(), rates: allRates().slice(1) })).not.toEqual([]);
    expect(issuesOf({ ...validInput(), rates: [...allRates(), rateOf('16')] })).not.toEqual([]);
  });

  it('refuses a wilaya listed twice', () => {
    const rates = allRates().map((rate, index) => (index === 0 ? rateOf('16') : rate));

    expect(issuesOf({ ...validInput(), rates })).not.toEqual([]);
  });

  it('refuses an unknown wilaya code', () => {
    const rates = allRates().map((rate, index) => (index === 0 ? rateOf('59') : rate));

    expect(issuesOf({ ...validInput(), rates })).not.toEqual([]);
  });

  it('bounds the overweight allowance and rate', () => {
    expect(issuesOf({ ...validInput(), overweightAllowanceKg: MAX_OVERWEIGHT_ALLOWANCE_KG + 1 })).not.toEqual([]);
    expect(issuesOf({ ...validInput(), overweightAllowanceKg: -1 })).not.toEqual([]);
    expect(issuesOf({ ...validInput(), overweightRate: MAX_OVERWEIGHT_RATE + 1 })).not.toEqual([]);
    expect(issuesOf({ ...validInput(), overweightRate: 0.5 })).not.toEqual([]);
  });

  it('reads a missing carrier as no carrier and keeps a sent one for the API to check', () => {
    const withoutCarrier = Object.fromEntries(Object.entries(validInput()).filter(([key]) => key !== 'carrierId'));

    expect(deliveryFeeGroupInputSchema.parse(withoutCarrier).carrierId).toBeNull();
    expect(deliveryFeeGroupInputSchema.parse({ ...validInput(), carrierId: '7' }).carrierId).toBe('7');
  });
});

describe('deliveryFeeGroupSchema', () => {
  it('parses a stored group with base prices on each rate', () => {
    const group = {
      ...validInput(),
      id: '1000000000000000001',
      isPlatformDefault: true,
      createdAt: '2026-11-22T10:00:00.000Z',
      updatedAt: '2026-11-22T10:00:00.000Z',
      rates: allRates().map((rate) => ({ ...rate, baseHomePrice: 600, baseDeskPrice: 400 })),
    };

    expect(deliveryFeeGroupSchema.parse(group)).toEqual(group);
  });
});

describe('shippingQuoteSchema', () => {
  const resolved = {
    baseFee: 600,
    overweightFee: 100,
    totalFee: 700,
    resolved: true,
    speed: 'standard',
    offeredSpeeds: ['standard'],
    freeShipping: false,
    waivedFee: 0,
  };

  it('parses a resolved quote in the data-model shape', () => {
    expect(shippingQuoteSchema.parse(resolved)).toEqual(resolved);
  });

  it('parses an unresolved quote with no speed', () => {
    const unresolved = { ...resolved, baseFee: 0, overweightFee: 0, totalFee: 0, resolved: false, speed: null };

    expect(shippingQuoteSchema.parse({ ...unresolved, offeredSpeeds: [] }).speed).toBeNull();
  });

  it('refuses an unknown speed and a negative fee', () => {
    expect(shippingQuoteSchema.safeParse({ ...resolved, speed: 'express' }).success).toBe(false);
    expect(shippingQuoteSchema.safeParse({ ...resolved, totalFee: -1 }).success).toBe(false);
  });
});
