import { describe, expect, it } from 'vitest';
import {
  INT_COLUMN_MAX,
  MAX_LINE_QUANTITY,
  MAX_QUOTE_CODES,
  MAX_QUOTE_LINES,
  PRICING_ERROR_CODES,
  quoteRequestSchema,
} from '../../src/index';

/**
 * The cart-quote body of the research (data-model.md, storefront ordering protocol step 3), with synthetic ids. Variant
 * ids are Vendure core ids (Postgres `integer`); the snowflake store id is stripped.
 */
const researchRequest = {
  storeId: '1000000000000000001',
  channel: 'storefront',
  lines: [{ productId: '10', variantId: '11', quantity: 1 }],
  destination: { provinceCode: '16', stopdesk: false },
  phone: '+213555000111',
  codes: ['INFLU10'],
};

const line = (quantity: number) => ({ variantId: '11', quantity });
const linesOf = (count: number) =>
  Array.from({ length: count }, (_unused, index) => ({ variantId: String(2000 + index), quantity: 1 }));

describe('quoteRequestSchema', () => {
  it('accepts the research cart-quote request', () => {
    const result = quoteRequestSchema.safeParse(researchRequest);

    expect(result.success).toBe(true);
    expect(result.data?.lines).toEqual([{ variantId: '11', quantity: 1 }]);
    expect(result.data?.destination).toEqual({ provinceCode: '16', stopdesk: false });
    expect(result.data?.codes).toEqual(['INFLU10']);
  });

  it('never carries the store or business sent in the body', () => {
    const result = quoteRequestSchema.parse({ ...researchRequest, businessId: '7' });

    expect(result).not.toHaveProperty('storeId');
    expect(result).not.toHaveProperty('businessId');
  });

  it('accepts a request without destination or phone', () => {
    const result = quoteRequestSchema.safeParse({ channel: 'storefront', lines: [line(2)] });

    expect(result.success).toBe(true);
  });

  it('accepts 50 lines', () => {
    expect(quoteRequestSchema.safeParse({ channel: 'storefront', lines: linesOf(MAX_QUOTE_LINES) }).success).toBe(true);
  });

  it('refuses 51 lines', () => {
    expect(quoteRequestSchema.safeParse({ channel: 'storefront', lines: linesOf(MAX_QUOTE_LINES + 1) }).success).toBe(
      false,
    );
  });

  it('refuses an empty cart', () => {
    expect(quoteRequestSchema.safeParse({ channel: 'storefront', lines: [] }).success).toBe(false);
  });

  it('refuses quantity 0 and 1000', () => {
    expect(quoteRequestSchema.safeParse({ channel: 'storefront', lines: [line(0)] }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ channel: 'storefront', lines: [line(1000)] }).success).toBe(false);
    expect(quoteRequestSchema.safeParse({ channel: 'storefront', lines: [line(MAX_LINE_QUANTITY)] }).success).toBe(
      true,
    );
  });

  it('refuses a fractional quantity', () => {
    expect(quoteRequestSchema.safeParse({ channel: 'storefront', lines: [line(1.5)] }).success).toBe(false);
  });

  it('refuses six codes', () => {
    const codes = Array.from({ length: MAX_QUOTE_CODES + 1 }, (_unused, index) => `CODE${String(index)}`);

    expect(quoteRequestSchema.safeParse({ channel: 'storefront', lines: [line(1)], codes }).success).toBe(false);
  });

  it.each([
    ['a NUL', 'ABC\u0000'],
    ['a bidi override', '\u202EABC'],
    ['a lone surrogate', 'ABC\uD800'],
    ['a line break', 'AB\nC'],
  ])('refuses a code with %s', (_name, code) => {
    const result = quoteRequestSchema.safeParse({ channel: 'storefront', lines: [line(1)], codes: [code] });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(PRICING_ERROR_CODES.INVALID_REQUEST);
  });

  it('refuses a code longer than 64 characters', () => {
    const codes = ['A'.repeat(65)];

    expect(quoteRequestSchema.safeParse({ channel: 'storefront', lines: [line(1)], codes }).success).toBe(false);
  });

  it('refuses an unknown province code', () => {
    const destination = { provinceCode: '70', stopdesk: false };

    expect(quoteRequestSchema.safeParse({ channel: 'storefront', lines: [line(1)], destination }).success).toBe(false);
  });

  it('refuses an unknown channel', () => {
    expect(quoteRequestSchema.safeParse({ channel: 'kiosk', lines: [line(1)] }).success).toBe(false);
  });

  it('normalises 0555…, +213555… and 213 555… to one E.164 phone', () => {
    const phones = ['0555 00 01 11', '+213555000111', '213 555 000 111', '00213555000111', '+2130555000111'];

    const parsed = phones.map(
      (phone) => quoteRequestSchema.parse({ channel: 'storefront', lines: [line(1)], phone }).phone,
    );

    expect(new Set(parsed)).toEqual(new Set(['+213555000111']));
  });

  it('normalises 00213 0555… to the same E.164 phone', () => {
    const phone = quoteRequestSchema.parse({
      channel: 'storefront',
      lines: [line(1)],
      phone: '00213 0555 00 01 11',
    }).phone;

    expect(phone).toBe('+213555000111');
  });

  it('reads a blank phone as no phone', () => {
    const parsed = ['', '   '].map(
      (phone) => quoteRequestSchema.parse({ channel: 'storefront', lines: [line(1)], phone }).phone,
    );

    expect(parsed).toEqual([null, null]);
  });

  it.each(['+0555000111', '+21300555000111', '0213555000111'])('refuses %s, which is not one E.164 number', (phone) => {
    const result = quoteRequestSchema.safeParse({ channel: 'storefront', lines: [line(1)], phone });

    expect(result.success).toBe(false);
  });

  it('refuses an unparseable phone', () => {
    const result = quoteRequestSchema.safeParse({ channel: 'storefront', lines: [line(1)], phone: 'call me' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(PRICING_ERROR_CODES.INVALID_REQUEST);
  });

  it('strips a productId sent on a line', () => {
    const result = quoteRequestSchema.parse({
      channel: 'storefront',
      lines: [{ productId: '99', variantId: '11', quantity: 1 }],
    });

    expect(result.lines[0]).not.toHaveProperty('productId');
  });

  it('accepts the largest variant id of the integer column', () => {
    const lines = [{ variantId: String(INT_COLUMN_MAX), quantity: 1 }];

    expect(quoteRequestSchema.safeParse({ channel: 'storefront', lines }).success).toBe(true);
  });

  it.each(['2147483648', '99999999999', '9'.repeat(32), '0', '012'])(
    'refuses a variant id beyond the integer column or not canonical: %s',
    (variantId) => {
      const result = quoteRequestSchema.safeParse({ channel: 'storefront', lines: [{ variantId, quantity: 1 }] });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(PRICING_ERROR_CODES.INVALID_REQUEST);
    },
  );

  it('keeps a trimmed town code and refuses an empty variant id', () => {
    const destination = { provinceCode: '16', townOns: ' 1652 ', stopdesk: true };

    expect(quoteRequestSchema.parse({ channel: 'storefront', lines: [line(1)], destination }).destination).toEqual({
      provinceCode: '16',
      townOns: '1652',
      stopdesk: true,
    });
    expect(
      quoteRequestSchema.safeParse({ channel: 'storefront', lines: [{ variantId: '', quantity: 1 }] }).success,
    ).toBe(false);
  });
});
