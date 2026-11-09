import { describe, expect, it } from 'vitest';
import { STORE_CHANNEL_POLL_MS, STORE_SWITCH_TIMEOUT_MS } from '../dashboard/constants';
import { backoffRefreshTimes } from '../dashboard/model/refresh-schedule';

describe('backoffRefreshTimes', () => {
  it('refreshes after 1, then 2, then 4 more seconds within the 10 s store switch timeout', () => {
    expect(backoffRefreshTimes(STORE_CHANNEL_POLL_MS, STORE_SWITCH_TIMEOUT_MS)).toEqual([1_000, 3_000, 7_000]);
  });

  it('plans no refresh at or after the timeout', () => {
    expect(backoffRefreshTimes(1_000, 7_000)).toEqual([1_000, 3_000]);
    expect(backoffRefreshTimes(1_000, 1_000)).toEqual([]);
  });

  it('plans nothing for a non-positive first delay', () => {
    expect(backoffRefreshTimes(0, 10_000)).toEqual([]);
  });
});
