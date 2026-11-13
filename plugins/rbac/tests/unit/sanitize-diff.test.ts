import { describe, expect, it } from 'vitest';
import { REDACTED_VALUE } from '../../domain/constants';
import { sanitizeDiff } from '../../domain/sanitize-diff';

describe('sanitizeDiff', () => {
  it('redacts sensitive keys at any depth, in any case', () => {
    // Arrange
    const diff = {
      before: { user: { passwordHash: 'x', name: 'Amina' } },
      after: { resetToken: 'y', nested: [{ 'API-Key': 'z', label: 'kept' }] },
      Authorization: 'Bearer t',
      sessionCookie: 'c',
    };

    // Act
    const clean = sanitizeDiff(diff);

    // Assert
    expect(clean).toEqual({
      before: { user: { passwordHash: REDACTED_VALUE, name: 'Amina' } },
      after: { resetToken: REDACTED_VALUE, nested: [{ 'API-Key': REDACTED_VALUE, label: 'kept' }] },
      Authorization: REDACTED_VALUE,
      sessionCookie: REDACTED_VALUE,
    });
  });

  it.each([
    'privateKey',
    'private_key',
    'accessKey',
    'ACCESS-KEY',
    'session',
    'sessionId',
    'credential',
    'credentials',
    'cvv',
    'cardCvv',
    'otp',
    'otpCode',
    'hash',
    'apiKeys',
    'privateKeys',
    'accessKeys',
    'hashes',
    'otps',
    'sha256hash',
  ])('redacts %s', (key) => {
    // Act
    const clean = sanitizeDiff({ [key]: 'x' });

    // Assert
    expect(clean).toEqual({ [key]: REDACTED_VALUE });
  });

  // Every term of D66 (`password|secret|token|otp|hash|api.?key|authorization|cookie`, any case), alone, in a
  // compound and inside a word written without breaks: D66 matches a fragment, not a whole word.
  it.each([
    ['password', ['password', 'PASSWORD', 'newPassword', 'userpassword']],
    ['secret', ['secret', 'clientSecret', 'webhooksecret']],
    ['token', ['token', 'refresh_token', 'authtoken']],
    ['otp', ['otp', 'OTP', 'otpCode', 'otpcode', 'smsOtp', 'smsotp']],
    ['hash', ['hash', 'pinHash', 'pinhash', 'hashed', 'hashedPin', 'hashvalue', 'tokenHashes']],
    ['api.?key', ['apikey', 'apiKey', 'api_key', 'api-key', 'API.KEY', 'xApiKey', 'xapikey', 'myapikeys']],
    ['authorization', ['authorization', 'proxyAuthorization', 'proxyauthorization']],
    ['cookie', ['cookie', 'setCookie', 'sessioncookie']],
    [
      'any of them with a capital inside the term',
      ['passWord', 'PassWord', 'PASSword', 'SecRet', 'SECRETkey', 'toKen', 'TOKENvalue', 'oTp', 'OTPcode', 'HaSh'],
    ],
    ['api.?key, authorization and cookie in mixed case', ['ApI_kEy', 'APIkey', 'AuthoriZation', 'CooKie']],
  ])('redacts every spelling of the D66 term %s', (_term, keys) => {
    // Act
    const clean = sanitizeDiff(Object.fromEntries(keys.map((key) => [key, 'x'])));

    // Assert
    expect(clean).toEqual(Object.fromEntries(keys.map((key) => [key, REDACTED_VALUE])));
  });

  it.each(['footprint', 'hashtag', 'obsession', 'accessKeyboard', 'credentialing'])('keeps %s', (key) => {
    // Act
    const clean = sanitizeDiff({ [key]: 'x' });

    // Assert
    expect(clean).toEqual({ [key]: 'x' });
  });

  it('keeps ordinary keys and values', () => {
    // Arrange
    const diff = { name: 'Orders', permissions: ['a.b', 'c.d'], count: 3, flag: true, none: null };

    // Act
    const clean = sanitizeDiff(diff);

    // Assert
    expect(clean).toEqual(diff);
  });

  it('does not change its input', () => {
    // Arrange
    const diff = { secret: 'x', inner: { token: 'y' } };

    // Act
    sanitizeDiff(diff);

    // Assert
    expect(diff).toEqual({ secret: 'x', inner: { token: 'y' } });
  });

  it('replaces a 20 KB diff by a truncation marker', () => {
    // Arrange
    const diff = { notes: 'a'.repeat(20 * 1024) };

    // Act
    const clean = sanitizeDiff(diff);

    // Assert
    expect(clean).toEqual({ truncated: true });
  });

  it('keeps a diff just under the limit', () => {
    // Arrange
    const diff = { notes: 'a'.repeat(15 * 1024) };

    // Act
    const clean = sanitizeDiff(diff);

    // Assert
    expect(clean).toEqual(diff);
  });

  it('survives a diff that refers to itself and values JSON cannot hold', () => {
    // Arrange
    const loop: Record<string, unknown> = { id: 1n, at: new Date('2026-01-02T03:04:05.000Z') };
    loop['self'] = loop;

    // Act
    const clean = sanitizeDiff(loop);

    // Assert
    expect(clean).toEqual({ id: '1', at: '2026-01-02T03:04:05.000Z', self: '[OMITTED]' });
  });
});
