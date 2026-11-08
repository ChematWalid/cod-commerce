import { describe, expect, it } from 'vitest';
import { isrEntryKey, isrTagKey, useCacheEntryKey, useCacheTagKey } from '../../cache/keys';

describe('cache keys', () => {
  it('prefixes ISR entry keys with the deployment id', () => {
    // Arrange
    const key = '/route-cache/APP_PAGE/_t/demo/ar';
    // Act
    const entryKey = isrEntryKey('v2', key);
    // Assert
    expect(entryKey).toBe('next:v2:isr:/route-cache/APP_PAGE/_t/demo/ar');
  });

  it('gives two deployments different ISR keys for the same entry', () => {
    expect(isrEntryKey('v1', '/x')).not.toBe(isrEntryKey('v2', '/x'));
  });

  it('prefixes use-cache entry keys with the deployment id', () => {
    expect(useCacheEntryKey('v2', 'abc')).toBe('next:v2:uc:abc');
  });

  it('keeps tag keys free of the deployment id so revalidation reaches every deployment', () => {
    expect(isrTagKey('store:demo')).toBe('next:tag:store:demo');
    expect(useCacheTagKey('store:demo')).toBe('next:uc-tag:store:demo');
  });
});
