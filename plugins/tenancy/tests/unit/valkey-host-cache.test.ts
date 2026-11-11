import type { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';
import type { StoreResolution } from '../../domain/store-resolution';
import { HostInvalidationSubscriber } from '../../infrastructure/host-invalidation.subscriber';
import { LruHostCache } from '../../infrastructure/lru';
import { ValkeyHostCache } from '../../infrastructure/valkey-host-cache';

const HOST = 'atlas.example.test';

const RESOLUTION: StoreResolution = {
  storeId: '500',
  businessId: '100',
  language: 'ar',
  name: 'Atlas',
  logo: null,
  primaryHost: HOST,
  status: 'active',
};

/** A Valkey that keeps strings in a map, shared by every cache built on it. */
class MapValkey {
  readonly values = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.values.get(key) ?? null);
  }

  readonly published: [string, string][] = [];

  set(key: string, value: string): Promise<'OK'> {
    this.values.set(key, value);
    return Promise.resolve('OK');
  }

  del(...keys: string[]): Promise<number> {
    return Promise.resolve(keys.filter((key) => this.values.delete(key)).length);
  }

  publish(channel: string, message: string): Promise<number> {
    this.published.push([channel, message]);
    return Promise.resolve(0);
  }

  asRedis(): Redis {
    return this as unknown as Redis;
  }
}

describe('ValkeyHostCache', () => {
  it('reads back what it wrote', async () => {
    // Arrange
    const cache = new ValkeyHostCache(new MapValkey().asRedis(), 'production');
    await cache.set(HOST, RESOLUTION);

    // Act
    const found = await cache.get(HOST);

    // Assert
    expect(found).toEqual(RESOLUTION);
  });

  it.each([
    ['a non-JSON value', 'not json'],
    ['a JSON value of the wrong shape', JSON.stringify({ storeId: 500, status: 'active' })],
    ['an archived store', JSON.stringify({ ...RESOLUTION, status: 'archived' })],
    ['a missing field', JSON.stringify({ ...RESOLUTION, name: undefined })],
    ['null', 'null'],
  ])('treats %s as a miss', async (_case, raw) => {
    // Arrange
    const valkey = new MapValkey();
    const cache = new ValkeyHostCache(valkey.asRedis(), 'production');
    await cache.set(HOST, RESOLUTION);
    const [key] = [...valkey.values.keys()];
    valkey.values.set(key ?? '', raw);

    // Act
    const found = await cache.get(HOST);

    // Assert
    expect(found).toBeNull();
  });

  it('keeps two environments sharing one Valkey apart', async () => {
    // Arrange
    const valkey = new MapValkey();
    const staging = new ValkeyHostCache(valkey.asRedis(), 'staging');
    const production = new ValkeyHostCache(valkey.asRedis(), 'production');
    await staging.set(HOST, RESOLUTION);

    // Act
    const seenByProduction = await production.get(HOST);

    // Assert
    expect(seenByProduction).toBeNull();
    expect(valkey.values.size).toBe(1);
  });

  it('publishes invalidations on its environment channel, and on the legacy one for the deploy (D309)', async () => {
    // Arrange
    const valkey = new MapValkey();
    const cache = new ValkeyHostCache(valkey.asRedis(), 'staging');

    // Act
    await cache.publish([HOST]);

    // Assert
    expect(valkey.published.map(([channel]) => channel)).toEqual(['host-invalidate:staging', 'host-invalidate']);
  });

  it('deletes the namespaced key and the legacy key a previous release may have written', async () => {
    // Arrange
    const valkey = new MapValkey();
    valkey.values.set(`host:staging:${HOST}`, '{}');
    valkey.values.set(`host:${HOST}`, '{}');
    valkey.values.set(`host:production:${HOST}`, '{}');

    // Act
    await new ValkeyHostCache(valkey.asRedis(), 'staging').delete([HOST]);

    // Assert
    expect([...valkey.values.keys()]).toEqual([`host:production:${HOST}`]);
  });
});

describe('HostInvalidationSubscriber', () => {
  it('listens on its environment channel and the legacy one only', async () => {
    // Arrange
    const subscribed: string[] = [];
    const redis = {
      on: () => redis,
      subscribe: (...channels: string[]) => {
        subscribed.push(...channels);
        return Promise.resolve(channels.length);
      },
    };
    const subscriber = new HostInvalidationSubscriber(redis as unknown as Redis, new LruHostCache(), 'production');

    // Act
    await subscriber.start();

    // Assert
    expect(subscribed).toEqual(['host-invalidate:production', 'host-invalidate']);
  });
});
