import {
  CODE_MAX_LENGTH,
  INT_COLUMN_MAX,
  MAX_LINE_OFFERS_APPLIED,
  MAX_LINE_QUANTITY,
  MAX_ORDER_DISCOUNTS_APPLIED,
  MAX_QUOTE_LINES,
  MAX_QUOTE_TOKEN_LENGTH,
  MONEY_MAX_DZD,
} from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { UnsignableQuoteError } from '../../../domain/errors';
import { signQuote, verifyQuoteToken, type QuotePayloadBody } from '../../../domain/token/quote-token';
import { aLine } from '../../support/builders';
import { aProductDiscount, quoteOf } from '../../support/pipeline';
import { aBody, aVerifyInput, ISSUED_AT, NONCE, RING_K1 } from '../../support/quote-token';

/** The widest snowflake id, 19 digits. */
const WIDEST_SNOWFLAKE = '9223372036854775807';
const ALL = { order: true, product: true, delivery: true };

const signAt = (issuedAt: number, payload: QuotePayloadBody = aBody()) =>
  signQuote({ ring: RING_K1, payload, issuedAt, nonce: NONCE });

/** A body at every width bound: the most lines, the widest ids and prices, the most offers per line and codes. */
function aWorstCaseBody(lineCount: number): QuotePayloadBody {
  const line = {
    variantId: String(INT_COLUMN_MAX),
    qty: MAX_LINE_QUANTITY,
    unitPrice: MONEY_MAX_DZD,
    originalPrice: MONEY_MAX_DZD,
    offerIds: Array.from({ length: MAX_LINE_OFFERS_APPLIED }, () => WIDEST_SNOWFLAKE),
  };
  const discount = { amount: MONEY_MAX_DZD, offerId: WIDEST_SNOWFLAKE, code: 'X'.repeat(CODE_MAX_LENGTH) };
  return aBody({
    b: WIDEST_SNOWFLAKE,
    s: WIDEST_SNOWFLAKE,
    p: 1,
    t: MONEY_MAX_DZD,
    sh: MONEY_MAX_DZD,
    l: Array.from({ length: lineCount }, () => line),
    d: Array.from({ length: MAX_ORDER_DISCOUNTS_APPLIED }, () => discount),
  });
}

describe('signQuote: bounds', () => {
  it('signs a worst-case cart of MAX_QUOTE_LINES lines into a token verify accepts as well formed', () => {
    // Arrange
    const body = aWorstCaseBody(MAX_QUOTE_LINES);

    // Act
    const { token } = signAt(ISSUED_AT, body);
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(token.length).toBeLessThanOrEqual(MAX_QUOTE_TOKEN_LENGTH);
    expect(result).not.toEqual({ ok: false, reason: 'malformed' });
  });

  it('signs the quote of MAX_QUOTE_LINES lines that more combinable product offers hit than the engine applies', () => {
    // Arrange
    const offers = Array.from({ length: MAX_LINE_OFFERS_APPLIED * 3 }, (_, index) => ({
      id: String(BigInt(WIDEST_SNOWFLAKE) - BigInt(index)),
      config: { valueType: 'fixed', value: 1 + index, appliesTo: 'all' },
    }));
    const lines = Array.from({ length: MAX_QUOTE_LINES }, (_, index) =>
      aLine({ variantId: String(INT_COLUMN_MAX - index), productId: String(index + 1), quantity: MAX_LINE_QUANTITY }),
    );
    const quote = quoteOf(
      { offers: offers.map(({ id, config }) => aProductDiscount({ id, config, combinesWith: ALL })) },
      { lines },
    );

    // Act
    const l = quote.tokenLines.map((line) => ({ ...line, offerIds: [...line.offerIds] }));
    const { token } = signAt(ISSUED_AT, aBody({ l, d: [...quote.tokenDiscounts] }));

    // Assert
    expect(quote.tokenLines.every(({ offerIds }) => offerIds.length === MAX_LINE_OFFERS_APPLIED)).toBe(true);
    expect(token.length).toBeLessThanOrEqual(MAX_QUOTE_TOKEN_LENGTH);
  });

  it('refuses to sign a token longer than MAX_QUOTE_TOKEN_LENGTH', () => {
    // Arrange
    const body = aWorstCaseBody(MAX_QUOTE_LINES * 4);

    // Act
    const sign = () => signAt(ISSUED_AT, body);

    // Assert
    expect(sign).toThrow(UnsignableQuoteError);
  });
});

describe('signQuote: issuedAt', () => {
  it('refuses to sign a fractional issuedAt', () => {
    // Arrange
    const issuedAt = ISSUED_AT + 0.25;

    // Act
    const sign = () => signAt(issuedAt);

    // Assert
    expect(sign).toThrow(UnsignableQuoteError);
  });

  it('refuses to sign an issuedAt in milliseconds', () => {
    // Arrange
    const issuedAt = ISSUED_AT * 1_000;

    // Act
    const sign = () => signAt(issuedAt);

    // Assert
    expect(sign).toThrow(UnsignableQuoteError);
  });

  it('refuses to sign a negative issuedAt', () => {
    // Arrange
    const issuedAt = -1;

    // Act
    const sign = () => signAt(issuedAt);

    // Assert
    expect(sign).toThrow(UnsignableQuoteError);
  });
});

describe('signQuote: payload', () => {
  it.each([
    ['a zero line quantity', aBody({ l: [{ variantId: '7', qty: 0, unitPrice: 1, originalPrice: 1, offerIds: [] }] })],
    ['a negative total', aBody({ t: -1 })],
    ['a fractional delivery price', aBody({ sh: 1.5 })],
    ['a store id that is not a decimal', aBody({ s: 'store-a' })],
    ['an offer id with a leading zero', aBody({ d: [{ amount: 1, offerId: '07' }] })],
  ])('refuses to sign a body with %s', (_label, body) => {
    // Arrange
    const payload = body;

    // Act
    const sign = () => signAt(ISSUED_AT, payload);

    // Assert
    expect(sign).toThrow(UnsignableQuoteError);
  });
});
