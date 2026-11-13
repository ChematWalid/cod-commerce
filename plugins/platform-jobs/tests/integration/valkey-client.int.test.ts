import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VALKEY_HUNG_SOCKET_TIMEOUTS } from '../../domain/constants';
import { connectFixture, releaseFixture, type ValkeyFixture } from '../fakes/valkey-fixture';

/** What ioredis rejects a command with when `commandTimeout` passes. */
const timedOut = (): Promise<never> => Promise.reject(new Error('Command timed out'));

let fixture: ValkeyFixture;

beforeEach(async () => {
  fixture = await connectFixture();
});

afterEach(async () => {
  await releaseFixture(fixture);
});

describe('PlatformValkey', () => {
  it('keeps the connection after one command timeout, so in-flight commands are not rejected', async () => {
    // Arrange
    const inFlight = fixture.redis.ping();

    // Act
    await fixture.valkey.runCleanup(timedOut);

    // Assert
    await expect(inFlight).resolves.toBe('PONG');
    expect(fixture.redis.status).toBe('ready');
  });

  it('replaces the socket after five command timeouts in a row', async () => {
    // Arrange
    let closes = 0;
    fixture.redis.on('close', () => {
      closes += 1;
    });
    const reconnected = new Promise<void>((resolve) =>
      fixture.redis.once('ready', () => {
        resolve();
      }),
    );

    // Act
    for (let attempt = 0; attempt < VALKEY_HUNG_SOCKET_TIMEOUTS; attempt += 1) {
      await fixture.valkey.runCleanup(timedOut);
    }
    await reconnected;

    // Assert
    expect(closes).toBe(1);
    await expect(fixture.redis.ping()).resolves.toBe('PONG');
  });

  it('counts timeouts afresh after a command succeeds', async () => {
    // Act
    for (let attempt = 1; attempt < VALKEY_HUNG_SOCKET_TIMEOUTS; attempt += 1) {
      await fixture.valkey.runCleanup(timedOut);
    }
    await fixture.valkey.runCleanup((redis) => redis.ping());
    await fixture.valkey.runCleanup(timedOut);

    // Assert
    expect(fixture.redis.status).toBe('ready');
  });
});
