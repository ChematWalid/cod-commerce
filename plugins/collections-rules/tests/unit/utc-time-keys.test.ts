import { describe, expect, it } from 'vitest';
import { utcDayKey, utcHourKey } from '../../domain/utc-time-keys';

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
});
