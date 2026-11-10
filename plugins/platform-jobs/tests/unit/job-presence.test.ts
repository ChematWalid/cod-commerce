import { describe, expect, it } from 'vitest';
import { presenceOf } from '../../domain/job-presence.port';

describe('presenceOf', () => {
  it.each([
    ['waiting', 'live'],
    ['active', 'live'],
    ['delayed', 'live'],
    ['prioritized', 'live'],
    ['waiting-children', 'live'],
    ['failed', 'failed'],
    ['completed', 'completed'],
    ['unknown', 'missing'],
  ] as const)('reads BullMQ state %s as %s', (state, presence) => {
    expect(presenceOf(state)).toBe(presence);
  });
});
