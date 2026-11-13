import { describe, expect, it } from 'vitest';
import { DIFF_MAX_DEPTH, DIFF_OMITTED_VALUE, REDACTED_VALUE } from '../../domain/constants';
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
    [
      'any of them overlapping a benign word',
      ['footprintOken', 'FootprintOKEN', 'footprintsEcret', 'hashtagsECRET', 'HashtagsEcretId', 'footprintPassword'],
    ],
    ['any of them before a benign word', ['tokenFootprint', 'secretHashtag', 'passwordFootprints', 'otpHashtags']],
    ['any of them mid-run', ['authorizationHeader', 'cookieValue', 'cookiejar', 'apisKey', 'api1Key']],
    ['any of them in fullwidth letters', ['\uff50\uff41\uff53\uff53\uff57\uff4f\uff52\uff44', 'p\uff41ssword']],
  ])('redacts every spelling of the D66 term %s', (_term, keys) => {
    // Act
    const clean = sanitizeDiff(Object.fromEntries(keys.map((key) => [key, 'x'])));

    // Assert
    expect(clean).toEqual(Object.fromEntries(keys.map((key) => [key, REDACTED_VALUE])));
  });

  // The extra terms of P1.S3 match like the D66 terms: anywhere in the run, any case, digits and acronyms around them.
  it.each([
    'sessionid',
    'session2',
    'sessions',
    'cvv2',
    'cardCvv2',
    'cardcvv',
    'CVVCode',
    'credentialsjson',
    'privatekeypem',
    'accessKey1',
    'AWSAccessKey',
    'HTTPSession',
    'v2Session',
    'PGPPrivateKey',
  ])('redacts the extra term in %s', (key) => {
    // Act
    const clean = sanitizeDiff({ [key]: 'x' });

    // Assert
    expect(clean).toEqual({ [key]: REDACTED_VALUE });
  });

  it('redacts a key too long to read, failing closed', () => {
    // Arrange
    const key = 'A'.repeat(100_000);

    // Act
    const started = performance.now();
    const clean = sanitizeDiff({ [key]: 'x' });

    // Assert
    expect(clean).toEqual({ [key]: REDACTED_VALUE });
    expect(performance.now() - started).toBeLessThan(50);
  });

  it('stores an invalid date as omitted, and a Date subclass as its real time', () => {
    // Arrange
    class LyingDate extends Date {
      override toISOString(): string {
        return 'leak';
      }
    }
    const when = new LyingDate(0);

    // Act
    const clean = sanitizeDiff({ broken: new Date('not a date'), when });

    // Assert
    expect(clean).toEqual({ broken: DIFF_OMITTED_VALUE, when: '1970-01-01T00:00:00.000Z' });
  });

  it('omits a branch nested deeper than the depth limit', () => {
    // Arrange
    let deep: Record<string, unknown> = { leaf: 'x' };
    for (let level = 0; level < DIFF_MAX_DEPTH + 2; level += 1) deep = { inner: deep };

    // Act
    const stored = JSON.stringify(sanitizeDiff(deep));

    // Assert
    expect(stored).toContain(JSON.stringify(DIFF_OMITTED_VALUE));
    expect(stored).not.toContain('leaf');
  });

  it.each(['footprint', 'hashtag', 'obsession', 'possession'])('keeps %s', (key) => {
    // Act
    const clean = sanitizeDiff({ [key]: 'x' });

    // Assert
    expect(clean).toEqual({ [key]: 'x' });
  });

  it('drops a function, so an own toJSON cannot write unsanitized secrets', () => {
    // Arrange
    const diff = { meta: { toJSON: () => ({ password: 'leak' }), label: 'kept' } };

    // Act
    const stored = JSON.stringify(sanitizeDiff(diff));

    // Assert
    expect(stored).not.toContain('leak');
    expect(JSON.parse(stored)).toEqual({ meta: { toJSON: DIFF_OMITTED_VALUE, label: 'kept' } });
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
