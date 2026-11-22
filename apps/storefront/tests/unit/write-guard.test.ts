import { describe, expect, it } from 'vitest';
import { CACHE_ENTRY_MAX_BYTES, CACHE_MEMORY_GUARD_POLL_MS, CACHE_WRITES_OFF_TTL_SECONDS } from '../../cache/constants';
import { writesOffKey } from '../../cache/keys';
import { CacheWriteGuard, fitsEntryLimit, memoryUsageRatio } from '../../cache/write-guard';
import { FakeCacheRedis } from '../support/fake-cache-redis';

const memoryInfo = (used: number, max: number): string =>
  `# Memory\r\nused_memory:${String(used)}\r\nused_memory_human:1M\r\nmaxmemory:${String(max)}\r\n`;

describe('cache entry size limit', () => {
  it('accepts an entry of exactly 512 KB', () => {
    expect(fitsEntryLimit('a'.repeat(CACHE_ENTRY_MAX_BYTES))).toBe(true);
  });

  it('refuses an entry one byte over 512 KB', () => {
    expect(fitsEntryLimit('a'.repeat(524_289))).toBe(false);
  });

  it('counts bytes, not characters', () => {
    // Arrange: an Arabic letter is two bytes in UTF-8.
    const arabic = 'ب'.repeat(CACHE_ENTRY_MAX_BYTES / 2 + 1);
    // Act and Assert
    expect(fitsEntryLimit(arabic)).toBe(false);
  });
});

describe('memoryUsageRatio', () => {
  it('reads used_memory over maxmemory from INFO memory', () => {
    expect(memoryUsageRatio(memoryInfo(30, 100))).toBeCloseTo(0.3);
  });

  it('has no ratio when maxmemory is unlimited or missing', () => {
    expect(memoryUsageRatio(memoryInfo(30, 0))).toBeNull();
    expect(memoryUsageRatio('# Memory\r\n')).toBeNull();
  });
});

describe('cache write guard', () => {
  it('turns writes off and shares the switch with a 120 s TTL when Valkey is 60 % full', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    redis.memoryInfo = memoryInfo(60, 100);
    const guard = new CacheWriteGuard({ appEnv: 'staging' });
    // Act
    const allowed = await guard.allowsWrites(redis);
    // Assert
    expect(allowed).toBe(false);
    expect(redis.recordedSets).toEqual([
      { key: 'staging:cache:writes-off', options: { expiration: { type: 'EX', value: CACHE_WRITES_OFF_TTL_SECONDS } } },
    ]);
  });

  it('follows the switch another instance set', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    redis.strings.set(writesOffKey('staging'), '1');
    // Act
    const allowed = await new CacheWriteGuard({ appEnv: 'staging' }).allowsWrites(redis);
    // Assert
    expect(allowed).toBe(false);
    expect(redis.recordedSets).toEqual([]);
  });

  it('allows writes while Valkey has room and no switch is set', async () => {
    await expect(new CacheWriteGuard({ appEnv: 'staging' }).allowsWrites(new FakeCacheRedis())).resolves.toBe(true);
  });

  it('asks Valkey again only after the 30 s poll interval', async () => {
    // Arrange
    let now = 1_000_000;
    const redis = new FakeCacheRedis();
    const guard = new CacheWriteGuard({ appEnv: 'staging', now: () => now });
    await guard.allowsWrites(redis);
    redis.strings.set(writesOffKey('staging'), '1');
    // Act
    const beforePoll = await guard.allowsWrites(redis);
    now += CACHE_MEMORY_GUARD_POLL_MS;
    const afterPoll = await guard.allowsWrites(redis);
    // Assert
    expect(beforePoll).toBe(true);
    expect(afterPoll).toBe(false);
  });

  it('keeps its last state when Valkey cannot answer the poll', async () => {
    // Arrange
    const redis = new FakeCacheRedis();
    redis.info = () => Promise.reject(new Error('READONLY'));
    // Act
    const allowed = await new CacheWriteGuard({ appEnv: 'staging' }).allowsWrites(redis);
    // Assert
    expect(allowed).toBe(true);
  });
});
