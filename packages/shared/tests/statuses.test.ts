import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, TRACKING_STATUSES } from '../src/index';

describe('statuses', () => {
  it('lists the eight ADR 0009 order states in order', () => {
    expect(ORDER_STATUSES).toEqual([
      'pending',
      'confirmed',
      'scheduled',
      'canceled',
      'abandoned',
      'dispatched',
      'delivered',
      'returned',
    ]);
  });

  it('lists unique tracking statuses', () => {
    expect(TRACKING_STATUSES.length).toBeGreaterThan(0);
    expect(new Set(TRACKING_STATUSES).size).toBe(TRACKING_STATUSES.length);
  });
});
