import { describe, expect, it } from 'vitest';
import { MAX_ADDON_PIECES, MAX_QUOTE_ADDONS, PRICING_ERROR_CODES, quoteRequestSchema } from '../../src/index';

const OFFER_ID = '1000000000000000123';
const cart = { channel: 'storefront', lines: [{ variantId: '11', quantity: 1 }] };
const addon = (variantId: string, quantity = 1) => ({ offerId: OFFER_ID, variantId, quantity });
const addonsOf = (count: number) => Array.from({ length: count }, (_unused, index) => addon(String(300 + index)));

describe('quoteRequestSchema add-ons', () => {
  it('accepts a quote request with two add-ons', () => {
    const result = quoteRequestSchema.safeParse({ ...cart, addons: [addon('21'), addon('22', 2)] });

    expect(result.success).toBe(true);
    expect(result.data?.addons).toEqual([addon('21'), addon('22', 2)]);
  });

  it('defaults add-ons to an empty list', () => {
    expect(quoteRequestSchema.parse(cart).addons).toEqual([]);
  });

  it('refuses six add-ons', () => {
    const result = quoteRequestSchema.safeParse({ ...cart, addons: addonsOf(MAX_QUOTE_ADDONS + 1) });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(PRICING_ERROR_CODES.INVALID_REQUEST);
  });

  it('refuses an add-on quantity above the per-order cap', () => {
    expect(quoteRequestSchema.safeParse({ ...cart, addons: [addon('21', MAX_ADDON_PIECES + 1)] }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ ...cart, addons: [addon('21', 0)] }).success).toBe(false);
  });

  it('refuses an add-on id that is not a canonical decimal id', () => {
    expect(quoteRequestSchema.safeParse({ ...cart, addons: [{ ...addon('21'), offerId: '0123' }] }).success).toBe(
      false,
    );
    expect(quoteRequestSchema.safeParse({ ...cart, addons: [addon('2147483648')] }).success).toBe(false);
  });

  it('refuses the same add-on twice', () => {
    expect(quoteRequestSchema.safeParse({ ...cart, addons: [addon('21'), addon('21', 2)] }).success).toBe(false);
  });
});
