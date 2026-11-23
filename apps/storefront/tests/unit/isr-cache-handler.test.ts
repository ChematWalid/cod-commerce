import { afterEach, describe, expect, it, vi } from 'vitest';
import { CACHE_COMMAND_TIMEOUT_MS, CACHE_ENTRY_MAX_BYTES, CACHE_ENTRY_MAX_TTL_SECONDS } from '../../cache/constants';
import { createIsrCacheHandler, type IsrCacheHandler } from '../../cache/isr-cache-handler';
import { writesOffKey } from '../../cache/keys';
import { CacheUnavailableError } from '../../cache/redis-connection';
import { CacheWriteGuard } from '../../cache/write-guard';
import { FakeCacheRedis } from '../support/fake-cache-redis';

/** How much later than the command timeout a stalled read may settle (timer and scheduling jitter). */
const TIMEOUT_SLACK_MS = 150;

const PAGE_KEY = '/route-cache/APP_PAGE/_t/demo/ar';
const STORE_TAG = 'store:demo';

function handlerFor(redis: FakeCacheRedis | null, deploymentId: string): IsrCacheHandler {
  const Handler = createIsrCacheHandler({
    getClient: () => Promise.resolve(redis),
    deploymentId,
    writeGuard: new CacheWriteGuard({ appEnv: 'test' }),
  });
  return new Handler({});
}

/** An app page entry as Next hands it over: tags in the header, a `Buffer` and a `Map` inside. */
function appPageEntry(html: string): Record<string, unknown> {
  return {
    kind: 'APP_PAGE',
    html,
    rscData: Buffer.from(`rsc:${html}`),
    segmentData: new Map([['/_index', Buffer.from('segment')]]),
    headers: { 'x-next-cache-tags': `${STORE_TAG},_N_T_/layout` },
  };
}

describe('ISR cache handler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('revalidating a tag removes the entry of every deployment', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    const [v1, v2] = [handlerFor(redis, 'v1'), handlerFor(redis, 'v2')];
    await v1.set(PAGE_KEY, appPageEntry('one'));
    await v2.set(PAGE_KEY, appPageEntry('two'));
    // Act
    await v2.revalidateTag(STORE_TAG);
    // Assert
    await expect(v1.get(PAGE_KEY)).resolves.toBeNull();
    await expect(v2.get(PAGE_KEY)).resolves.toBeNull();
  });

  it('does not serve one deployment the other deployment entry', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    await handlerFor(redis, 'v1').set(PAGE_KEY, appPageEntry('one'));
    // Act
    const hit = await handlerFor(redis, 'v2').get(PAGE_KEY);
    // Assert
    expect(hit).toBeNull();
  });

  it('round-trips Map and Buffer values', async () => {
    // Arrange
    const handler = handlerFor(new FakeCacheRedis(), 'v1');
    await handler.set(PAGE_KEY, appPageEntry('one'));
    // Act
    const value = (await handler.get(PAGE_KEY))?.value as Record<string, unknown>;
    // Assert
    expect(value['rscData']).toEqual(Buffer.from('rsc:one'));
    expect(value['segmentData']).toEqual(new Map([['/_index', Buffer.from('segment')]]));
  });

  it('degrades to a miss when Redis is unavailable', async () => {
    // Arrange
    const handler = handlerFor(null, 'v1');
    // Act
    await handler.set(PAGE_KEY, appPageEntry('one'));
    const hit = await handler.get(PAGE_KEY);
    // Assert
    expect(hit).toBeNull();
  });

  it('throws on revalidateTag when Redis is unavailable', async () => {
    await expect(handlerFor(null, 'v1').revalidateTag(STORE_TAG)).rejects.toThrow(CacheUnavailableError);
  });

  it('sets a TTL of at most 6 h on every entry and tag index', async () => {
    // Arrange: one entry without an expire, one with a longer one than the cap, one with a short one.
    const redis = new FakeCacheRedis();
    const handler = handlerFor(redis, 'v1');
    // Act
    await handler.set('/a', appPageEntry('a'));
    await handler.set('/b', appPageEntry('b'), { cacheControl: { expire: 7 * 24 * 3600 } });
    await handler.set('/c', appPageEntry('c'), { tags: ['fetch:c'], cacheControl: { expire: 60 } });
    // Assert
    expect(redis.recordedSets.map(({ options }) => options.expiration.value)).toEqual([
      CACHE_ENTRY_MAX_TTL_SECONDS,
      CACHE_ENTRY_MAX_TTL_SECONDS,
      60,
    ]);
    expect([...redis.sortedSets.keys()].sort()).toEqual([
      'next:tag:_N_T_/layout',
      'next:tag:fetch:c',
      'next:tag:store:demo',
    ]);
    for (const tagKey of redis.sortedSets.keys()) {
      const expires = redis.recordedExpires.filter(({ key }) => key === tagKey);
      expect(expires.length).toBeGreaterThan(0);
      expect(Math.max(...expires.map(({ seconds }) => seconds))).toBeLessThanOrEqual(CACHE_ENTRY_MAX_TTL_SECONDS);
    }
  });

  it('writes the tag index, ZADD, pruning and EXPIRE in one transaction, before the entry', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    const handler = handlerFor(redis, 'v1');
    // Act
    await handler.set(PAGE_KEY, appPageEntry('one'));
    // Assert: a crash between the two writes can leave an unindexed tag, never an entry revalidation misses.
    expect(redis.operations).toEqual([
      'multi[zAdd next:tag:store:demo, zRemRangeByScore next:tag:store:demo, expire next:tag:store:demo]',
      'multi[zAdd next:tag:_N_T_/layout, zRemRangeByScore next:tag:_N_T_/layout, expire next:tag:_N_T_/layout]',
      `set next:v1:isr:${PAGE_KEY}`,
    ]);
  });

  it('does not write the entry when its tags cannot be indexed', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    redis.failTransactions = true;
    const handler = handlerFor(redis, 'v1');
    // Act
    await handler.set(PAGE_KEY, appPageEntry('one'));
    // Assert
    await expect(handler.get(PAGE_KEY)).resolves.toBeNull();
    expect(redis.recordedSets).toEqual([]);
  });

  it('does not write an entry over 512 KB, so a read misses', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    const handler = handlerFor(redis, 'v1');
    // Act
    await handler.set(PAGE_KEY, appPageEntry('x'.repeat(CACHE_ENTRY_MAX_BYTES)));
    // Assert
    await expect(handler.get(PAGE_KEY)).resolves.toBeNull();
    expect(redis.operations).toEqual([]);
  });

  it('writes neither the entry nor its tags while the writes-off switch is set', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    redis.strings.set(writesOffKey('test'), '1');
    const handler = handlerFor(redis, 'v1');
    // Act
    await handler.set(PAGE_KEY, appPageEntry('one'));
    // Assert
    expect(redis.operations).toEqual([]);
    expect(redis.sortedSets.size).toBe(0);
  });

  it('settles a read from a Valkey that never answers as a miss within the command timeout', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    redis.hang = true;
    const handler = handlerFor(redis, 'v1');
    const startedAt = performance.now();
    // Act
    const hit = await handler.get(PAGE_KEY);
    // Assert
    expect(hit).toBeNull();
    expect(performance.now() - startedAt).toBeLessThan(CACHE_COMMAND_TIMEOUT_MS + TIMEOUT_SLACK_MS);
  });

  it('prunes an expired entry from the tag index on the next write', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    const redis = new FakeCacheRedis();
    const handler = handlerFor(redis, 'v1');
    await handler.set('/old', appPageEntry('old'), { cacheControl: { expire: 60 } });
    vi.setSystemTime(Date.now() + 61_000);
    // Act
    await handler.set('/new', appPageEntry('new'), { cacheControl: { expire: 60 } });
    // Assert
    expect(redis.members('next:tag:store:demo')).toEqual(['next:v1:isr:/new']);
  });

  it('revalidates a tag in one transaction that deletes its entries and their index members', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    const handler = handlerFor(redis, 'v1');
    await handler.set(PAGE_KEY, appPageEntry('one'));
    redis.operations.length = 0;
    // Act
    await handler.revalidateTag(STORE_TAG);
    // Assert
    expect(redis.operations).toEqual([
      `multi[del next:v1:isr:${PAGE_KEY}, zRem next:tag:store:demo, zRemRangeByScore next:tag:store:demo]`,
    ]);
    expect(redis.members('next:tag:store:demo')).toEqual([]);
  });
});
