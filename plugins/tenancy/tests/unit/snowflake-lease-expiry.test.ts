import type { Redis } from 'ioredis';
import { afterEach, describe, expect, it } from 'vitest';
import { WORKER_LEASE_TTL_MS } from '../../domain/constants';
import { IdGeneratorNotReadyError } from '../../domain/errors';
import { ValkeySnowflakeGenerator } from '../../infrastructure/valkey-snowflake.generator';

const SLOW_REPLY_MS = 5000;
const STARTED_AT = 1_700_000_000_000;

/** A Valkey whose every reply takes {@link SLOW_REPLY_MS} on the test clock, and which grants every lease. */
class SlowValkey {
  constructor(private readonly clock: { now: number }) {}

  set(): Promise<'OK'> {
    this.clock.now += SLOW_REPLY_MS;
    return Promise.resolve('OK');
  }

  eval(): Promise<number> {
    this.clock.now += SLOW_REPLY_MS;
    return Promise.resolve(1);
  }

  disconnect(): void {
    // Nothing to close.
  }
}

describe('ValkeySnowflakeGenerator lease expiry', () => {
  const generators: ValkeySnowflakeGenerator[] = [];

  afterEach(async () => {
    for (const generator of generators.splice(0)) await generator.onApplicationShutdown();
  });

  const start = async (clock: { now: number }): Promise<ValkeySnowflakeGenerator> => {
    const generator = new ValkeySnowflakeGenerator(new SlowValkey(clock) as unknown as Redis, { now: () => clock.now });
    generators.push(generator);
    await generator.onApplicationBootstrap();
    return generator;
  };

  it('counts a new lease from when the command was sent, not from the slow reply', async () => {
    // Arrange
    const clock = { now: STARTED_AT };
    const generator = await start(clock);

    // Act
    clock.now = STARTED_AT + WORKER_LEASE_TTL_MS;

    // Assert
    expect(() => generator.next()).toThrow(IdGeneratorNotReadyError);
  });

  it('counts a renewed lease from when the renewal was sent', async () => {
    // Arrange
    const clock = { now: STARTED_AT };
    const generator = await start(clock);
    const renewalSentAt = clock.now;
    await generator.renew();

    // Act
    clock.now = renewalSentAt + WORKER_LEASE_TTL_MS;

    // Assert
    expect(() => generator.next()).toThrow(IdGeneratorNotReadyError);
  });

  it('still makes ids just before the lease ends', async () => {
    // Arrange
    const clock = { now: STARTED_AT };
    const generator = await start(clock);

    // Act
    clock.now = STARTED_AT + WORKER_LEASE_TTL_MS - 1;

    // Assert
    expect(generator.next()).toBeTruthy();
  });

  it('extends the lease on renewal, past the expiry of the first lease', async () => {
    // Arrange
    const clock = { now: STARTED_AT };
    const generator = await start(clock);
    const renewalSentAt = clock.now;
    await generator.renew();

    // Act: after the first lease would have ended, before the renewed one does
    clock.now = renewalSentAt + WORKER_LEASE_TTL_MS - 1;

    // Assert
    expect(generator.next()).toBeTruthy();
  });
});
