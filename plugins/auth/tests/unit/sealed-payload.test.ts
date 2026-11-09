import { describe, expect, it } from 'vitest';
import { SealedPayloadCodec, SealedPayloadError } from '../../infrastructure/sealed-payload';

const SECRET = 'unit-test-only-secret-0000000000000000';
const PAYLOAD = { kind: 'verification', to: 'owner@example.test', vars: { code: '123456', link: 'https://x.test/t' } };

describe('SealedPayloadCodec', () => {
  const codec = new SealedPayloadCodec(SECRET);

  it('round-trips a payload', () => {
    // Act
    const opened = codec.open(codec.seal(PAYLOAD));

    // Assert
    expect(opened).toEqual(PAYLOAD);
  });

  it('hides the plaintext', () => {
    // Act
    const sealed = codec.seal(PAYLOAD);

    // Assert
    expect(sealed).not.toContain('123456');
    expect(sealed).not.toContain('owner@example.test');
  });

  it('seals the same payload differently each time', () => {
    expect(codec.seal(PAYLOAD)).not.toBe(codec.seal(PAYLOAD));
  });

  it('rejects a tampered payload', () => {
    // Arrange
    const sealed = codec.seal(PAYLOAD);
    const flipped = `${sealed.slice(0, -2)}${sealed.endsWith('AA') ? 'BB' : 'AA'}`;

    // Act and assert
    expect(() => codec.open(flipped)).toThrow(SealedPayloadError);
  });

  it.each(['', 'v1.', 'v1.AAAA', 'v9.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'plain text'])(
    'rejects the malformed value %j',
    (malformed) => {
      expect(() => codec.open(malformed)).toThrow(SealedPayloadError);
    },
  );

  it('does not open under another secret', () => {
    expect(() => new SealedPayloadCodec(`${SECRET}x`).open(codec.seal(PAYLOAD))).toThrow(SealedPayloadError);
  });

  it('does not use the secret itself as the key', () => {
    // Arrange: a codec whose key is derived under another label must not open it.
    const other = new SealedPayloadCodec(SECRET, 'another-label');

    // Act and assert
    expect(() => other.open(codec.seal(PAYLOAD))).toThrow(SealedPayloadError);
  });
});
