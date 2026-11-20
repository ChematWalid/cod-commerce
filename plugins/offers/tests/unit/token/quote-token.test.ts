import { QUOTE_TTL_SECONDS } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { cartHash, phoneKey } from '../../../domain/token/cart-hash';
import { signQuote, verifyQuoteToken } from '../../../domain/token/quote-token';
import { aQuoteKey, aQuoteKeyRing } from '../../support/quote-keys';
import {
  aBody,
  aCartFor,
  anExpectation,
  aToken,
  aVerifyInput,
  ISSUED_AT,
  NONCE,
  payloadOf,
  tampered,
  PHONE,
  RING_K1,
} from '../../support/quote-token';

describe('signQuote', () => {
  it('round-trips a token', () => {
    // Arrange
    const body = aBody();

    // Act
    const signed = signQuote({ ring: RING_K1, payload: body, issuedAt: ISSUED_AT, nonce: NONCE });
    const result = verifyQuoteToken(aVerifyInput(signed.token));

    // Assert
    expect(signed.token).toMatch(/^qt1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
    expect(signed.expiresAt).toBe(ISSUED_AT + QUOTE_TTL_SECONDS);
    expect(result).toEqual({
      ok: true,
      payload: { ...body, v: 1, kid: 'k1', exp: ISSUED_AT + QUOTE_TTL_SECONDS, n: NONCE },
    });
  });

  it('keeps a snowflake id above 2^53 exact in b and s', () => {
    // Arrange
    const business = '9007199254740993';
    const store = '9223372036854775807';
    const token = aToken(aBody({ b: business, s: store }));

    // Act
    const result = verifyQuoteToken(
      aVerifyInput(token, { expect: anExpectation({ businessId: business, storeId: store }) }),
    );

    // Assert
    expect(result.ok && [result.payload.b, result.payload.s]).toEqual([business, store]);
  });
});

describe('verifyQuoteToken: cart and phone', () => {
  it('adds the phone key only when p is 1', () => {
    // Arrange
    const cartHashFor = vi.fn((key: string | null) => cartHash(aCartFor(key)));
    const withPhone = aToken(aBody({ p: 1, h: cartHash(aCartFor(phoneKey(aQuoteKey('k1').secret, PHONE))) }));
    const withoutPhone = aToken(aBody({ p: 0 }));
    const expect_ = anExpectation({ phone: PHONE, cartHashFor });

    // Act
    verifyQuoteToken(aVerifyInput(withoutPhone, { expect: expect_ }));
    verifyQuoteToken(aVerifyInput(withPhone, { expect: expect_ }));

    // Assert
    expect(cartHashFor.mock.calls).toEqual([[null], [phoneKey(aQuoteKey('k1').secret, PHONE)]]);
  });

  it('verifies a per-buyer quote with its phone', () => {
    // Arrange
    const token = aToken(aBody({ p: 1, h: cartHash(aCartFor(phoneKey(aQuoteKey('k1').secret, PHONE))) }));

    // Act
    const result = verifyQuoteToken(aVerifyInput(token, { expect: anExpectation({ phone: PHONE }) }));

    // Assert
    expect(result.ok).toBe(true);
  });

  it('fails a per-buyer quote with another phone as cart_mismatch', () => {
    // Arrange
    const token = aToken(aBody({ p: 1, h: cartHash(aCartFor(phoneKey(aQuoteKey('k1').secret, PHONE))) }));

    // Act
    const results = [
      verifyQuoteToken(aVerifyInput(token, { expect: anExpectation({ phone: '+213555999999' }) })),
      verifyQuoteToken(aVerifyInput(token, { expect: anExpectation({ phone: null }) })),
    ];

    // Assert
    expect(results).toEqual([
      { ok: false, reason: 'cart_mismatch' },
      { ok: false, reason: 'cart_mismatch' },
    ]);
  });

  it('fails a token for another cart as cart_mismatch', () => {
    // Arrange
    const token = aToken();
    const otherCart = anExpectation({
      cartHashFor: (key) => cartHash({ ...aCartFor(key), lines: [{ variantId: '7', quantity: 3 }] }),
    });

    // Act
    const result = verifyQuoteToken(aVerifyInput(token, { expect: otherCart }));

    // Assert
    expect(result).toEqual({ ok: false, reason: 'cart_mismatch' });
  });
});

describe('verifyQuoteToken: scope and time', () => {
  it('fails a token for another store as store_mismatch', () => {
    // Arrange
    const token = aToken();

    // Act
    const result = verifyQuoteToken(aVerifyInput(token, { expect: anExpectation({ storeId: '7390000000000000099' }) }));

    // Assert
    expect(result).toEqual({ ok: false, reason: 'store_mismatch' });
  });

  it('fails a token for another business as business_mismatch', () => {
    // Arrange
    const token = aToken();

    // Act
    const result = verifyQuoteToken(
      aVerifyInput(token, { expect: anExpectation({ businessId: '7390000000000000098' }) }),
    );

    // Assert
    expect(result).toEqual({ ok: false, reason: 'business_mismatch' });
  });

  it('expires at exp, not after', () => {
    // Arrange
    const token = aToken();
    const { exp } = payloadOf(token);

    // Act
    const before = verifyQuoteToken(aVerifyInput(token, { now: exp - 1 }));
    const atExp = verifyQuoteToken(aVerifyInput(token, { now: exp }));

    // Assert
    expect(before.ok).toBe(true);
    expect(atExp).toEqual({ ok: false, reason: 'expired' });
  });
});

describe('verifyQuoteToken: key rotation', () => {
  it('verifies an old kid while it stays in the ring', () => {
    // Arrange
    const token = aToken(aBody(), aQuoteKeyRing(['k1'], 'k1'));
    const rotated = aQuoteKeyRing(['k1', 'k2'], 'k2');

    // Act
    const result = verifyQuoteToken(aVerifyInput(token, { ring: rotated }));

    // Assert
    expect(result.ok && result.payload.kid).toBe('k1');
  });

  it('signs with the active kid of the ring', () => {
    // Arrange
    const rotated = aQuoteKeyRing(['k1', 'k2'], 'k2');

    // Act
    const token = aToken(aBody(), rotated);

    // Assert
    expect(payloadOf(token).kid).toBe('k2');
  });

  it('fails an unknown kid like a bad signature', () => {
    // Arrange
    const token = aToken(aBody(), aQuoteKeyRing(['k1'], 'k1'));
    const withoutK1 = aQuoteKeyRing(['k2'], 'k2');

    // Act
    const result = verifyQuoteToken(aVerifyInput(token, { ring: withoutK1 }));

    // Assert
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });
});

describe('signQuote: gift lines', () => {
  const GIFT_LINES = [
    { variantId: '7', qty: 2, unitPrice: 4_900, originalPrice: 4_900, offerIds: [] },
    { variantId: '7', qty: 1, unitPrice: 0, originalPrice: 4_900, offerIds: ['7005'], g: '7005' },
  ];

  it('round-trips a gift line entry', () => {
    // Arrange
    const body = aBody({ t: 9_800, l: GIFT_LINES, o: [{ offerId: '7005' }] });

    // Act
    const result = verifyQuoteToken(aVerifyInput(aToken(body)));

    // Assert
    expect(result.ok && result.payload.l).toEqual(GIFT_LINES);
  });

  it('fails a token whose gift offer was changed as a bad signature', () => {
    // Arrange
    const token = tampered(aToken(aBody({ t: 9_800, l: GIFT_LINES })), (payload) => {
      const gift = payload.l[1];
      if (gift !== undefined) gift.g = '7006';
    });

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });
});

describe('signQuote: add-ons (D2506)', () => {
  const ANY_ORDER_ADDON = { offerId: '7006', variantId: '21', qty: 1, unitPrice: 1_200, parentVariantId: null };
  const RIDING_ADDON = { ...ANY_ORDER_ADDON, variantId: '22', parentVariantId: '7' };

  it('signs a with offerId and a null parent', () => {
    // Arrange
    const body = aBody({ t: 8_820 + 2_400, a: [ANY_ORDER_ADDON, RIDING_ADDON], o: [{ offerId: '7006' }] });

    // Act
    const result = verifyQuoteToken(aVerifyInput(aToken(body)));

    // Assert
    expect(result.ok && result.payload.a).toEqual([ANY_ORDER_ADDON, RIDING_ADDON]);
  });

  it('fails a token whose add-on price was changed as a bad signature', () => {
    // Arrange
    const token = tampered(aToken(aBody({ a: [ANY_ORDER_ADDON] })), (payload) => {
      const addon = payload.a[0];
      if (addon !== undefined) addon.unitPrice = 0;
    });

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });
});
