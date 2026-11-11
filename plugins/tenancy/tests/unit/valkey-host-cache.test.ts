import type { Redis } from 'ioredis';
import { describe, expect, it } from 'vitest';
import type { StoreResolution } from '../../domain/store-resolution';
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

  set(key: string, value: string): Promise<'OK'> {
    this.values.set(key, value);
    return Promise.resolve('OK');
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
});
