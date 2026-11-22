import { describe, expect, it } from 'vitest';
import { LruAvailabilityCache } from '../../infrastructure/lru-availability-cache';

const NARROWED = { home: true, desk: false, towns: new Map() };

describe('LruAvailabilityCache', () => {
  it('answers a cached value, a cached null, and a miss as undefined', () => {
    // Arrange
    const cache = new LruAvailabilityCache();
    cache.set('s:16', NARROWED);
    cache.set('s:01', null);

    // Act and Assert
    expect(cache.get('s:16')).toBe(NARROWED);
    expect(cache.get('s:01')).toBeNull();
    expect(cache.get('s:02')).toBeUndefined();
  });

  it('forgets an entry once its time to live has passed', () => {
    // Arrange
    let now = 0;
    const cache = new LruAvailabilityCache({ ttlMs: 30, now: () => now });
    cache.set('s:16', NARROWED);

    // Act
    now = 30;

    // Assert
    expect(cache.get('s:16')).toBeUndefined();
  });

  it('drops the least recently read entry past its bound', () => {
    // Arrange
    const cache = new LruAvailabilityCache({ maxEntries: 2 });
    cache.set('a', null);
    cache.set('b', null);
    cache.get('a');

    // Act
    cache.set('c', null);

    // Assert
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('c')).toBeNull();
  });
});
