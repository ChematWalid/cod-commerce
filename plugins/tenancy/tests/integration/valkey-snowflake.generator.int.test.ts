import { RESERVED_WORKER_ID_MIN, toSnowflake } from '@cod/shared';
import { Redis } from 'ioredis';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WORKER_LEASE_TTL_MS, workerLeaseKey } from '../../domain/constants';
import { IdGeneratorNotReadyError } from '../../domain/errors';
import { ValkeySnowflakeGenerator } from '../../infrastructure/valkey-snowflake.generator';

// The top of the reserved range, away from the ids the other integration tests pin.
const FIRST = RESERVED_WORKER_ID_MIN + 20;
const LAST = FIRST + 1;
const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6380';

describe('ValkeySnowflakeGenerator', () => {
  let probe: Redis;
  const started: ValkeySnowflakeGenerator[] = [];

  const start = async (): Promise<ValkeySnowflakeGenerator> => {
    const generator = new ValkeySnowflakeGenerator(new Redis(redisUrl), { firstWorkerId: FIRST, lastWorkerId: LAST });
    await generator.onApplicationBootstrap();
    started.push(generator);
    return generator;
  };

  const clear = async (): Promise<void> => {
    await probe.del(workerLeaseKey(FIRST), workerLeaseKey(LAST));
  };

  beforeEach(async () => {
    probe = new Redis(redisUrl);
    await clear();
  });

  afterEach(async () => {
    await Promise.all(started.splice(0).map((generator) => generator.onApplicationShutdown()));
    await clear();
    probe.disconnect();
  });

  it('leases the first free worker id with the ADR expiry', async () => {
    // Act
    const generator = await start();

    // Assert
    expect(generator.workerId).toBe(FIRST);
    const ttl = await probe.pttl(workerLeaseKey(FIRST));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(WORKER_LEASE_TTL_MS);
    expect(toSnowflake(generator.next())).toBeTruthy();
  });

  it('gives a second process the next worker id', async () => {
    // Arrange
    await start();

    // Act
    const second = await start();

    // Assert
    expect(second.workerId).toBe(LAST);
  });

  it('refuses ids when every worker id is held', async () => {
    // Arrange
    await start();
    await start();

    // Act
    const third = await start();

    // Assert
    expect(third.workerId).toBeUndefined();
    expect(() => third.next()).toThrow(IdGeneratorNotReadyError);
  });

  it('extends the lease on renewal', async () => {
    // Arrange
    const generator = await start();
    await probe.pexpire(workerLeaseKey(FIRST), 1000);

    // Act
    await generator.renew();

    // Assert
    expect(await probe.pttl(workerLeaseKey(FIRST))).toBeGreaterThan(1000);
    expect(generator.workerId).toBe(FIRST);
  });

  it('re-leases when another process took its worker id', async () => {
    // Arrange
    const generator = await start();
    await probe.set(workerLeaseKey(FIRST), 'someone-else');

    // Act
    await generator.renew();

    // Assert
    expect(generator.workerId).toBe(LAST);
    expect(await probe.get(workerLeaseKey(FIRST))).toBe('someone-else');
  });

  it('frees its worker id on shutdown', async () => {
    // Arrange
    const generator = await start();

    // Act
    await generator.onApplicationShutdown();

    // Assert
    expect(await probe.exists(workerLeaseKey(FIRST))).toBe(0);
  });
});
