import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { defaultEventKey, normalizeEventKey } from '../../domain/event-key';

const sha256 = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');

describe('defaultEventKey', () => {
  it('hashes the provider, the account and the raw bytes, joined by newlines', () => {
    // Arrange
    const body = Buffer.from('a=1&b=%C3%A9', 'utf8');

    // Act
    const key = defaultEventKey('acme', 'acct-1', body);

    // Assert
    expect(key).toBe(sha256(Buffer.concat([Buffer.from('acme\nacct-1\n'), body])));
    expect(key).toHaveLength(64);
  });

  it('tells two bodies that differ by one byte apart', () => {
    expect(defaultEventKey('acme', 'acct-1', Buffer.from('{"a":1}'))).not.toBe(
      defaultEventKey('acme', 'acct-1', Buffer.from('{"a":2}')),
    );
  });

  it('tells the same body of two accounts or two providers apart', () => {
    const body = Buffer.from('same');
    const keys = new Set([
      defaultEventKey('acme', 'acct-1', body),
      defaultEventKey('acme', 'acct-2', body),
      defaultEventKey('other', 'acct-1', body),
    ]);
    expect(keys.size).toBe(3);
  });
});

describe('normalizeEventKey', () => {
  it('keeps a key the column holds', () => {
    expect(normalizeEventKey('evt_123')).toBe('evt_123');
  });

  it('refuses an empty key and one over 128 characters', () => {
    expect(normalizeEventKey('')).toBeNull();
    expect(normalizeEventKey(null)).toBeNull();
    expect(normalizeEventKey('x'.repeat(129))).toBeNull();
    expect(normalizeEventKey('x'.repeat(128))).toBe('x'.repeat(128));
  });
});
