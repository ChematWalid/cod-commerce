import { describe, expect, it } from 'vitest';
import { DOMAIN_EVENT_NAMES, STORE_CHANGE_KINDS, storeChangedPayloadSchema } from '../../src/index';
import { isOutboxTopic } from '../../src/outbox/topics';

const VALID = { storeId: '7340032000000001', businessId: '42', change: 'settings' };

describe('store.changed event', () => {
  it('lists store.changed in DOMAIN_EVENT_NAMES and as an outbox topic', () => {
    // Assert
    expect(DOMAIN_EVENT_NAMES.StoreChanged).toBe('store.changed');
    expect(isOutboxTopic(DOMAIN_EVENT_NAMES.StoreChanged)).toBe(true);
  });

  it('names the three kinds of change', () => {
    // Assert
    expect(STORE_CHANGE_KINDS).toEqual(['settings', 'status', 'domain']);
  });

  it('accepts a payload of a store, its business and a kind', () => {
    // Act
    const parsed = storeChangedPayloadSchema.safeParse(VALID);

    // Assert
    expect(parsed.success).toBe(true);
  });

  it.each([
    ['a store id that is not a snowflake', { ...VALID, storeId: 'abc' }],
    ['a business id that is not a decimal id', { ...VALID, businessId: '-1' }],
    ['an unknown kind', { ...VALID, change: 'theme' }],
    ['a missing kind', { storeId: VALID.storeId, businessId: VALID.businessId }],
  ])('refuses %s', (_label, payload) => {
    // Act
    const parsed = storeChangedPayloadSchema.safeParse(payload);

    // Assert
    expect(parsed.success).toBe(false);
  });
});
