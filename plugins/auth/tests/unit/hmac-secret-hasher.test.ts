import { OTP_LENGTH } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { HmacSecretHasher } from '../../infrastructure/hmac-secret-hasher';

const KEY = 'test-only-secret-'.repeat(2);
const HMAC_HEX = /^[0-9a-f]{64}$/;
const BASE64URL_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

describe('HmacSecretHasher', () => {
  const hasher = new HmacSecretHasher(KEY);

  it('hashes to 64 hex characters, deterministically and unlike the secret', () => {
    // Act
    const hash = hasher.hash('abc');

    // Assert
    expect(hash).toMatch(HMAC_HEX);
    expect(hasher.hash('abc')).toBe(hash);
    expect(hash).not.toContain('abc');
  });

  it('depends on the key', () => {
    expect(new HmacSecretHasher(`${KEY}x`).hash('abc')).not.toBe(hasher.hash('abc'));
  });

  it('matches only the right secret', () => {
    const hash = hasher.hash('123456');

    expect(hasher.matches('123456', hash)).toBe(true);
    expect(hasher.matches('654321', hash)).toBe(false);
  });

  it('refuses a stored value that is not a hash', () => {
    expect(hasher.matches('123456', 'short')).toBe(false);
  });

  it('makes 32-byte base64url tokens that differ', () => {
    expect(hasher.newToken()).toMatch(BASE64URL_32_BYTES);
    expect(hasher.newToken()).not.toBe(hasher.newToken());
  });

  it('makes codes of exactly the configured digits, zeros included', () => {
    const codes = Array.from({ length: 2000 }, () => hasher.newOtp());

    expect(codes.every((code) => new RegExp(`^\\d{${String(OTP_LENGTH)}}$`).test(code))).toBe(true);
  });
});
