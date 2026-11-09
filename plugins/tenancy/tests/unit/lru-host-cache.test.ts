import { describe, expect, it } from 'vitest';
import type { StoreResolution } from '../../domain/store-resolution';
import { LruHostCache } from '../../infrastructure/lru';

const value = (name: string): StoreResolution => ({
  storeId: '1',
  businessId: '2',
  language: 'ar',
  name,
  logo: null,
  primaryHost: `${name}.localhost`,
  status: 'active',
});

describe('LruHostCache', () => {
  it('forgets an entry after its time to live', async () => {
    // Arrange
    let now = 0;
    const cache = new LruHostCache({ maxEntries: 10, ttlMs: 100, now: () => now });
    await cache.set('a', value('a'));

    // Act
    now = 100;

    // Assert
    await expect(cache.get('a')).resolves.toBeNull();
  });

  it('evicts the least recently used entry when full', async () => {
    // Arrange
    const cache = new LruHostCache({ maxEntries: 2, ttlMs: 1000, now: () => 0 });
    await cache.set('a', value('a'));
    await cache.set('b', value('b'));
    await cache.get('a');

    // Act
    await cache.set('c', value('c'));

    // Assert
    await expect(cache.get('b')).resolves.toBeNull();
    await expect(cache.get('a')).resolves.toEqual(value('a'));
  });

  it('drops the named hosts', async () => {
    // Arrange
    const cache = new LruHostCache({ maxEntries: 2, ttlMs: 1000, now: () => 0 });
    await cache.set('a', value('a'));

    // Act
    await cache.delete(['a']);

    // Assert
    await expect(cache.get('a')).resolves.toBeNull();
  });
});
