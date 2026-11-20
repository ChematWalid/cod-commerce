import { MAX_QUOTE_TOKEN_LENGTH } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { verifyQuoteToken } from '../../../domain/token/quote-token';
import { aQuoteKey } from '../../support/quote-keys';
import { aToken, aVerifyInput, payloadOf, signedRaw, tampered } from '../../support/quote-token';

const K1_SECRET = aQuoteKey('k1').secret;
const MALFORMED = { ok: false, reason: 'malformed' };
const BAD_SIGNATURE = { ok: false, reason: 'bad_signature' };

describe('verifyQuoteToken: tampering', () => {
  it('fails a token whose total was changed', () => {
    // Arrange
    const token = tampered(aToken(), (payload) => {
      payload.t = 1;
    });

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(result).toEqual(BAD_SIGNATURE);
  });

  it('fails a token whose line quantity was changed', () => {
    // Arrange
    const token = tampered(aToken(), (payload) => {
      payload.l = [{ variantId: '7', qty: 1, unitPrice: 4_410, originalPrice: 4_900, offerIds: ['7001'] }];
    });

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(result).toEqual(BAD_SIGNATURE);
  });

  it('fails a truncated signature', () => {
    // Arrange
    const token = aToken().slice(0, -2);

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(result).toEqual(BAD_SIGNATURE);
  });
});

describe('verifyQuoteToken: malformed tokens', () => {
  it('fails an oversized token as malformed without decoding it', () => {
    // Arrange
    const token = signedRaw({ ...payloadOf(aToken()), n: 'A'.repeat(MAX_QUOTE_TOKEN_LENGTH) }, K1_SECRET);

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(token.length).toBeGreaterThan(MAX_QUOTE_TOKEN_LENGTH);
    expect(result).toEqual(MALFORMED);
  });

  it('fails a validly signed payload with v 2 as malformed', () => {
    // Arrange
    const token = signedRaw({ ...payloadOf(aToken()), v: 2 }, K1_SECRET);

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(result).toEqual(MALFORMED);
  });

  it('fails a validly signed payload with a numeric b as malformed', () => {
    // Arrange
    const token = signedRaw({ ...payloadOf(aToken()), b: 7_390_000 }, K1_SECRET);

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(result).toEqual(MALFORMED);
  });

  it('fails a validly signed payload whose offer id is not a decimal as malformed', () => {
    // Arrange
    const token = signedRaw({ ...payloadOf(aToken()), d: [{ amount: 1, offerId: 'offer-1' }] }, K1_SECRET);

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(result).toEqual(MALFORMED);
  });

  it('fails a non-integer exp as malformed', () => {
    // Arrange
    const token = signedRaw({ ...payloadOf(aToken()), exp: 1_795_400_900.5 }, K1_SECRET);

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(result).toEqual(MALFORMED);
  });

  it('fails a token without the qt1 prefix as malformed', () => {
    // Arrange
    const token = aToken().replace(/^qt1\./, 'qt2.');

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(result).toEqual(MALFORMED);
  });

  it('fails a payload without a kid as malformed', () => {
    // Arrange
    const token = signedRaw({ ...payloadOf(aToken()), kid: undefined }, K1_SECRET);

    // Act
    const result = verifyQuoteToken(aVerifyInput(token));

    // Assert
    expect(result).toEqual(MALFORMED);
  });

  it('never throws on garbage input', () => {
    // Arrange
    const garbage: unknown[] = [
      '',
      '.',
      '..',
      'qt1..',
      'qt1.%%%.%%%',
      'qt1.bnVsbA.x',
      'qt1.W10.x',
      `qt1.${Buffer.from('{"kid":7}').toString('base64url')}.x`,
      `qt1.${Buffer.from('{"kid":"__proto__"}').toString('base64url')}.x`,
      'qt1.a.b.c',
      '\u0000￿',
      undefined,
      42,
    ];

    // Act
    const results = garbage.map((token) => verifyQuoteToken(aVerifyInput(token as string)));

    // Assert
    for (const result of results) {
      expect(result.ok).toBe(false);
    }
  });
});
