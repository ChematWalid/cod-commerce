import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { dataKeyAad, secretAad } from '../../domain/aad';
import { SecretUnreadableError } from '../../domain/errors';
import type { SealedBytes } from '../../domain/ports/envelope-cipher.port';
import { AesGcmEnvelope } from '../../infrastructure/aes-gcm-envelope';

const cipher = new AesGcmEnvelope();
const PLAINTEXT = Buffer.from('synthetic-secret-value-0123456789', 'utf8');
const AAD = secretAad('101', 'test-provider', 'primary');

const flipped = (bytes: Buffer): Buffer => {
  const copy = Buffer.from(bytes);
  copy[0] = (copy[0] ?? 0) ^ 1;
  return copy;
};

const failureOf = (work: () => unknown): SecretUnreadableError => {
  try {
    work();
  } catch (error) {
    if (error instanceof SecretUnreadableError) return error;
    throw error;
  }
  throw new Error('opened');
};

describe('AesGcmEnvelope', () => {
  it('makes a 32-byte data key each time', () => {
    // Act
    const first = cipher.newDataKey();
    const second = cipher.newDataKey();

    // Assert
    expect(first.length).toBe(32);
    expect(first.equals(second)).toBe(false);
  });

  it('opens what it sealed', () => {
    // Arrange
    const key = cipher.newDataKey();

    // Act
    const opened = cipher.open(key, cipher.seal(key, PLAINTEXT, AAD), AAD);

    // Assert
    expect(opened.equals(PLAINTEXT)).toBe(true);
  });

  it('seals with a fresh 12-byte iv and a 16-byte tag, and hides the plaintext', () => {
    // Arrange
    const key = cipher.newDataKey();

    // Act
    const first = cipher.seal(key, PLAINTEXT, AAD);
    const second = cipher.seal(key, PLAINTEXT, AAD);

    // Assert
    expect(first.iv.length).toBe(12);
    expect(first.tag.length).toBe(16);
    expect(first.iv.equals(second.iv)).toBe(false);
    expect(first.ciphertext.equals(second.ciphertext)).toBe(false);
    expect(first.ciphertext.toString('utf8')).not.toContain('synthetic');
  });

  it('refuses another AAD with tenant-secret.unreadable', () => {
    // Arrange
    const key = cipher.newDataKey();
    const sealed = cipher.seal(key, PLAINTEXT, AAD);

    // Act
    const failure = failureOf(() => cipher.open(key, sealed, secretAad('102', 'test-provider', 'primary')));

    // Assert
    expect(failure.code).toBe('tenant-secret.unreadable');
  });

  it.each([
    ['provider', secretAad('101', 'other-provider', 'primary')],
    ['ref', secretAad('101', 'test-provider', 'secondary')],
  ])('refuses an AAD that differs in the %s', (_part, aad) => {
    // Arrange
    const key = cipher.newDataKey();
    const sealed = cipher.seal(key, PLAINTEXT, AAD);

    // Act and Assert
    expect(() => cipher.open(key, sealed, aad)).toThrow(SecretUnreadableError);
  });

  it.each<[string, (sealed: SealedBytes) => SealedBytes]>([
    ['a ciphertext bit', (sealed) => ({ ...sealed, ciphertext: flipped(sealed.ciphertext) })],
    ['a tag bit', (sealed) => ({ ...sealed, tag: flipped(sealed.tag) })],
    ['an iv bit', (sealed) => ({ ...sealed, iv: flipped(sealed.iv) })],
    ['a shortened tag', (sealed) => ({ ...sealed, tag: sealed.tag.subarray(0, 8) })],
  ])('refuses %s flipped or cut, without repeating the plaintext', (_name, tamper) => {
    // Arrange
    const key = cipher.newDataKey();
    const sealed = tamper(cipher.seal(key, PLAINTEXT, AAD));

    // Act
    const failure = failureOf(() => cipher.open(key, sealed, AAD));

    // Assert
    expect(failure.message).not.toContain('synthetic');
  });

  it('refuses another key', () => {
    // Arrange
    const sealed = cipher.seal(cipher.newDataKey(), PLAINTEXT, AAD);

    // Act and Assert
    expect(() => cipher.open(cipher.newDataKey(), sealed, AAD)).toThrow(SecretUnreadableError);
  });

  it('wraps a data key under a KEK for one business and kid only', () => {
    // Arrange
    const kek = randomBytes(32);
    const dek = cipher.newDataKey();
    const wrapped = cipher.seal(kek, dek, dataKeyAad('101', 'k1'));

    // Act
    const unwrapped = cipher.open(kek, wrapped, dataKeyAad('101', 'k1'));

    // Assert
    expect(unwrapped.equals(dek)).toBe(true);
    expect(() => cipher.open(kek, wrapped, dataKeyAad('102', 'k1'))).toThrow(SecretUnreadableError);
    expect(() => cipher.open(kek, wrapped, dataKeyAad('101', 'k2'))).toThrow(SecretUnreadableError);
  });
});

describe('additional authenticated data', () => {
  it('binds a data key to its business and kid', () => {
    // Act and Assert
    expect(dataKeyAad('101', 'k1').toString('utf8')).toBe('tenant-data-key\n101\nk1');
  });

  it('binds a value to its business, provider and ref', () => {
    // Act and Assert
    expect(secretAad('101', 'test-provider', 'primary').toString('utf8')).toBe(
      'tenant-secret\n101\ntest-provider\nprimary',
    );
  });
});
