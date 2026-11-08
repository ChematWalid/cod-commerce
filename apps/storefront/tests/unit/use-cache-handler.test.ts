import { describe, expect, it } from 'vitest';
import type { CacheEntry } from 'next/dist/server/lib/cache-handlers/types';
import { CACHE_ENTRY_MAX_TTL_SECONDS } from '../../cache/constants';
import { CacheUnavailableError } from '../../cache/redis-connection';
import { createUseCacheHandler, type UseCacheHandler } from '../../cache/use-cache-handler';
import { FakeCacheRedis } from '../support/fake-cache-redis';

const STORE_TAG = 'store:demo';

function handlerFor(redis: FakeCacheRedis | null, deploymentId: string): UseCacheHandler {
  return createUseCacheHandler({ getClient: () => Promise.resolve(redis), deploymentId });
}

function entry(text: string, expire: number): CacheEntry {
  const bytes = new TextEncoder().encode(text);
  return {
    value: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    tags: [STORE_TAG],
    stale: 30,
    timestamp: Date.now() - 1,
    expire,
    revalidate: 900,
  };
}

const text = (cached: CacheEntry | undefined): Promise<string> => new Response(cached?.value).text();

describe("'use cache' handler", () => {
  it('serves an entry back with its streamed value', async () => {
    // Arrange
    const handler = handlerFor(new FakeCacheRedis(), 'v1');
    await handler.set('k', Promise.resolve(entry('hello', 3600)));
    // Act
    const cached = await handler.get('k', []);
    // Assert
    await expect(text(cached)).resolves.toBe('hello');
  });

  it('misses an entry whose tag was revalidated by another deployment', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    const v1 = handlerFor(redis, 'v1');
    await v1.set('k', Promise.resolve(entry('hello', 3600)));
    // Act
    await handlerFor(redis, 'v2').updateTags([STORE_TAG]);
    // Assert
    await expect(v1.get('k', [])).resolves.toBeUndefined();
  });

  it('caps the TTL of every entry and tag timestamp at 6 h', async () => {
    // Arrange: an entry whose expire is the "never" value Next uses for the default profile.
    const redis = new FakeCacheRedis();
    const handler = handlerFor(redis, 'v1');
    // Act
    await handler.set('k', Promise.resolve(entry('hello', 0xfffffffe)));
    await handler.updateTags([STORE_TAG]);
    // Assert
    expect(redis.recordedSets).toHaveLength(2);
    const ttls = redis.recordedSets.map(({ options }) => options.expiration.value);
    expect(Math.max(...ttls)).toBeLessThanOrEqual(CACHE_ENTRY_MAX_TTL_SECONDS);
  });

  it('throws on updateTags when Redis is unavailable', async () => {
    await expect(handlerFor(null, 'v1').updateTags([STORE_TAG])).rejects.toThrow(CacheUnavailableError);
  });
});
