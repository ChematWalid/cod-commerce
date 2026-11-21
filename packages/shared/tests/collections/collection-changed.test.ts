import { describe, expect, it } from 'vitest';
import { COLLECTION_CHANGE_KINDS, DOMAIN_EVENT_NAMES } from '../../src/index';
import { isOutboxTopic } from '../../src/outbox/topics';

describe('collection.changed event', () => {
  it('lists collection.changed in DOMAIN_EVENT_NAMES', () => {
    expect(DOMAIN_EVENT_NAMES.CollectionChanged).toBe('collection.changed');
  });

  it('is a known outbox topic', () => {
    expect(isOutboxTopic(DOMAIN_EVENT_NAMES.CollectionChanged)).toBe(true);
  });

  it('names the four kinds of change', () => {
    expect(COLLECTION_CHANGE_KINDS).toEqual(['created', 'updated', 'membership', 'deleted']);
  });
});
