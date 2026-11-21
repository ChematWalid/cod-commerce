import { describe, expect, it } from 'vitest';
import { msUntilNextUtcHour, utcDayKey, utcHourKey } from '../../domain/utc-time-keys';

describe('UTC time keys', () => {
  it('a day key is the UTC calendar day, zero padded', () => {
    // Arrange
    const justBeforeMidnight = Date.UTC(2026, 0, 5, 23, 59, 59, 999);

    // Act
    const keys = [utcDayKey(justBeforeMidnight), utcDayKey(justBeforeMidnight + 1)];

    // Assert
    expect(keys).toEqual(['20260105', '20260106']);
  });

  it('an hour key adds the UTC hour, zero padded', () => {
    // Arrange
    const earlyMorning = Date.UTC(2026, 10, 20, 7, 30);

    // Act
    const key = utcHourKey(earlyMorning);

    // Assert
    expect(key).toBe('2026112007');
  });

  it('the time left in the UTC hour runs to the next hour boundary', () => {
    // Arrange
    const quarterPast = Date.UTC(2026, 10, 20, 7, 15);
    const onTheHour = Date.UTC(2026, 10, 20, 8, 0);

    // Act
    const left = [msUntilNextUtcHour(quarterPast), msUntilNextUtcHour(onTheHour)];

    // Assert: a time on the boundary waits a whole hour, so it never runs at once
    expect(left).toEqual([45 * 60_000, 60 * 60_000]);
  });
});
