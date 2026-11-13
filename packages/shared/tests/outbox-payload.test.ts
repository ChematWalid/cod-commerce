import { describe, expect, it } from 'vitest';
import { OUTBOX_PAYLOAD_MAX_BYTES, OutboxPayloadRejectedError, validateOutboxPayload } from '../src/outbox/payload';
import { OUTBOX_TOPICS, isOutboxTopic } from '../src/outbox/topics';

const rejection = (payload: unknown): OutboxPayloadRejectedError => {
  try {
    validateOutboxPayload(payload);
  } catch (error) {
    if (error instanceof OutboxPayloadRejectedError) return error;
    throw error;
  }
  throw new Error('the payload was accepted');
};

describe('OUTBOX_TOPICS', () => {
  it('lists the platform topics', () => {
    // Assert
    expect([...OUTBOX_TOPICS]).toEqual([
      'order.placed',
      'order.confirmed',
      'order.delivered',
      'order.returned',
      'parcel.status_changed',
      'product.changed',
      'salary.paid',
      'platform.demo',
    ]);
  });

  it('tells a topic from any other string', () => {
    // Assert
    expect(isOutboxTopic('order.placed')).toBe(true);
    expect(isOutboxTopic('order.unknown')).toBe(false);
  });
});

describe('validateOutboxPayload', () => {
  it('returns a flat record of strings, numbers, booleans and null', () => {
    // Arrange
    const payload = { orderId: '7301', total: 4500, paid: false, note: null };

    // Act
    const result = validateOutboxPayload(payload);

    // Assert
    expect(result).toEqual(payload);
  });

  it.each([
    ['apiKey', { apiKey: 'x' }],
    ['api_key', { api_key: 'x' }],
    ['Password', { Password: 'x' }],
    ['clientSecret', { clientSecret: 'x' }],
    ['accessToken', { accessToken: 'x' }],
    ['otp', { otp: '1' }],
    ['Authorization', { Authorization: 'x' }],
    ['cookie', { cookie: 'x' }],
  ])('rejects the key %s', (_label, payload) => {
    // Act
    const error = rejection(payload);

    // Assert
    expect(error.code).toBe('outbox.payload-rejected');
    expect(error.message).not.toContain('"x"');
  });

  it('rejects a payload over the byte cap', () => {
    // Arrange
    const payload = { note: 'x'.repeat(OUTBOX_PAYLOAD_MAX_BYTES) };

    // Assert
    expect(rejection(payload).code).toBe('outbox.payload-rejected');
    expect(OUTBOX_PAYLOAD_MAX_BYTES).toBe(4096);
  });

  it('accepts a payload exactly at the cap and counts bytes, not characters', () => {
    // Arrange: `{"n":"` and `"}` take 8 bytes; each "é" takes two.
    const atCap = { n: 'x'.repeat(OUTBOX_PAYLOAD_MAX_BYTES - 8) };
    const overByBytes = { n: 'é'.repeat((OUTBOX_PAYLOAD_MAX_BYTES - 8) / 2 + 1) };

    // Assert
    expect(validateOutboxPayload(atCap)).toEqual(atCap);
    expect(rejection(overByBytes).code).toBe('outbox.payload-rejected');
  });

  it.each([
    ['null', null],
    ['an array', [1]],
    ['a string', 'x'],
    ['a nested object', { a: { b: 1 } }],
    ['an array value', { a: [1] }],
    ['undefined', { a: undefined }],
    ['a non-finite number', { a: Number.NaN }],
    ['a bigint', { a: 1n }],
  ])('rejects %s', (_label, payload) => {
    // Assert
    expect(rejection(payload).code).toBe('outbox.payload-rejected');
  });
});
