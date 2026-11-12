import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { InvalidSecretValueError } from '../../domain/errors';
import { SecretValue } from '../../domain/secret-value';

const PLAINTEXT = 'synthetic-secret-value-0123456789';

describe('SecretValue', () => {
  it('keeps the value as its UTF-8 bytes', () => {
    // Act
    const value = SecretValue.of(PLAINTEXT);

    // Assert
    expect(value.bytes().toString('utf8')).toBe(PLAINTEXT);
  });

  it('keeps the last four characters of a value of 12 characters or more', () => {
    // Act and Assert
    expect(SecretValue.of('abcdefghijkl').last4).toBe('ijkl');
    expect(SecretValue.of(PLAINTEXT).last4).toBe('6789');
  });

  it('keeps no last four characters under 12 characters', () => {
    // Act and Assert
    expect(SecretValue.of('abcdefghijk').last4).toBeNull();
    expect(SecretValue.of('x').last4).toBeNull();
  });

  it('counts characters, not UTF-16 units, so the last four fit the varchar(4) column', () => {
    // Arrange: eleven and twelve characters, the last of them outside the basic plane
    const eleven = 'a'.repeat(10) + '\u{1F512}';
    const twelve = 'a'.repeat(11) + '\u{1F512}';

    // Act and Assert
    expect(SecretValue.of(eleven).last4).toBeNull();
    expect(SecretValue.of(twelve).last4).toBe('aaa\u{1F512}');
  });

  it('refuses an empty value', () => {
    // Act and Assert
    expect(() => SecretValue.of('')).toThrow(InvalidSecretValueError);
  });

  it('accepts exactly 4096 bytes and refuses 4097', () => {
    // Act and Assert
    expect(SecretValue.of('a'.repeat(4096)).bytes().length).toBe(4096);
    expect(() => SecretValue.of('a'.repeat(4097))).toThrow(InvalidSecretValueError);
  });

  it('measures bytes, not characters', () => {
    // Arrange: 2 049 two-byte characters are 4 098 bytes
    const raw = 'é'.repeat(2049);

    // Act and Assert
    expect(() => SecretValue.of(raw)).toThrow(InvalidSecretValueError);
  });

  it('refuses text with a lone surrogate, which UTF-8 cannot carry', () => {
    // Act and Assert
    expect(() => SecretValue.of('abc\ud800def')).toThrow(InvalidSecretValueError);
  });

  it('carries the code tenant-secret.invalid-value and never repeats the value', () => {
    // Act
    const failure = (() => {
      try {
        SecretValue.of('a'.repeat(4097));
      } catch (error) {
        return error as InvalidSecretValueError;
      }
      throw new Error('accepted');
    })();

    // Assert
    expect(failure.code).toBe('tenant-secret.invalid-value');
    expect(failure.message).not.toContain('aaaa');
  });

  it('shows nothing of the value when printed, serialised or inspected', () => {
    // Arrange
    const value = SecretValue.of(PLAINTEXT);

    // Act
    const shown = [String(value), JSON.stringify(value), JSON.stringify({ value }), inspect(value), inspect({ value })];

    // Assert
    for (const text of shown) {
      expect(text).not.toContain('synthetic');
      expect(text).not.toContain('6789');
    }
  });
});
