import { describe, expect, it } from 'vitest';
import { type LimiterRedis, ValkeyRateLimiter } from '../../infrastructure/valkey-rate-limiter';
import { ManualClock } from '../fakes/manual-clock';

const QUIT_REFUSAL = 'connection is closed';

/** The part of the client the shutdown path touches. */
class FakeRedis {
  disconnects = 0;
  private readonly listeners: ((error: Error) => void)[] = [];

  constructor(private readonly quitOutcome: 'ok' | 'fails') {}

  on(_event: 'error', listener: (error: Error) => void): this {
    this.listeners.push(listener);
    return this;
  }

  emitError(error: Error): void {
    for (const listener of this.listeners) listener(error);
  }

  quit(): Promise<string> {
    return this.quitOutcome === 'ok' ? Promise.resolve('OK') : Promise.reject(new Error(QUIT_REFUSAL));
  }

  disconnect(): void {
    this.disconnects += 1;
  }
}

function limiterOn(redis: FakeRedis, clock: ManualClock): { limiter: ValkeyRateLimiter; messages: string[] } {
  const messages: string[] = [];
  const limiter = new ValkeyRateLimiter(redis as unknown as LimiterRedis, {
    logger: { error: (message) => messages.push(message) },
    now: clock.now,
  });
  return { limiter, messages };
}

describe('ValkeyRateLimiter shutdown', () => {
  it('logs a quit failure with a shutdown message even right after another report, and closes the socket', async () => {
    // Arrange
    const redis = new FakeRedis('fails');
    const { limiter, messages } = limiterOn(redis, new ManualClock());
    redis.emitError(new Error('ECONNRESET'));

    // Act
    await limiter.onApplicationShutdown();

    // Assert
    expect(messages).toHaveLength(2);
    expect(messages[1]).toContain('shutdown');
    expect(messages[1]).toContain(QUIT_REFUSAL);
    expect(messages[1]).not.toContain('limiting from memory');
    expect(redis.disconnects).toBe(1);
  });

  it('logs nothing and leaves the socket to quit when quit succeeds', async () => {
    // Arrange
    const redis = new FakeRedis('ok');
    const { limiter, messages } = limiterOn(redis, new ManualClock());

    // Act
    await limiter.onApplicationShutdown();

    // Assert
    expect(messages).toEqual([]);
    expect(redis.disconnects).toBe(0);
  });
});
