import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLimiterRedis, type LimiterRedis, ValkeyRateLimiter } from '../../infrastructure/valkey-rate-limiter';
import { TcpProxy } from '../fakes/tcp-proxy';

const VALKEY = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6380');
/** The brief's bound for one `consume` during an outage; the client's own command timeout is 250 ms. */
const MAX_CONSUME_MS = 500;
const LOGIN_PAIR_CAPACITY = 10;

interface Outage {
  readonly proxy: TcpProxy;
  readonly redis: LimiterRedis;
  readonly limiter: ValkeyRateLimiter;
  readonly errors: string[];
}

let outage: Outage;

async function connect(): Promise<Outage> {
  const proxy = await TcpProxy.start({ host: VALKEY.hostname, port: Number(VALKEY.port) });
  const redis = createLimiterRedis(`redis://127.0.0.1:${String(proxy.port)}`);
  const errors: string[] = [];
  const limiter = new ValkeyRateLimiter(redis, { logger: { error: (message) => errors.push(message) } });
  await limiter.onApplicationBootstrap();
  // Prove the path works before the fault, so a pass is not an artefact of never having connected.
  const warm = await limiter.consume('subdomain-ip', `warm-${randomUUID()}`);
  expect(warm.allowed).toBe(true);
  expect(errors).toEqual([]);
  return { proxy, redis, limiter, errors };
}

async function timed<T>(work: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const started = performance.now();
  const value = await work();
  return { value, ms: performance.now() - started };
}

async function drainLoginPair(
  limiter: ValkeyRateLimiter,
  key: string,
): Promise<{ allowed: boolean; slowestMs: number }[]> {
  const results = [];
  for (let attempt = 0; attempt <= LOGIN_PAIR_CAPACITY; attempt += 1) {
    const { value, ms } = await timed(() => limiter.consume('login-pair', key));
    results.push({ allowed: value.allowed, slowestMs: ms });
  }
  return results;
}

beforeEach(async () => {
  outage = await connect();
});

afterEach(() => {
  outage.redis.disconnect();
});

describe.each([
  [
    'a hung socket',
    (o: Outage) => {
      o.proxy.stopForwarding();
      return Promise.resolve();
    },
  ],
  ['a refused connection', (o: Outage) => o.proxy.refuseConnections()],
])('Valkey outage: %s', (_name, breakValkey) => {
  it('answers every consume within 500 ms and keeps a login policy limiting from memory', async () => {
    // Arrange
    await breakValkey(outage);

    // Act
    const results = await drainLoginPair(outage.limiter, `pair-${randomUUID()}`);

    // Assert
    expect(results.slice(0, LOGIN_PAIR_CAPACITY).every((result) => result.allowed)).toBe(true);
    expect(results[LOGIN_PAIR_CAPACITY]?.allowed).toBe(false);
    expect(Math.max(...results.map((result) => result.slowestMs))).toBeLessThan(MAX_CONSUME_MS);
  });

  it('allows the fail-open subdomain policy, and logs the error', async () => {
    // Arrange
    await breakValkey(outage);

    // Act
    const { value, ms } = await timed(() => outage.limiter.consume('subdomain-ip', `ip-${randomUUID()}`));

    // Assert
    expect(value.allowed).toBe(true);
    expect(ms).toBeLessThan(MAX_CONSUME_MS);
    expect(outage.errors).toHaveLength(1);
    expect(outage.errors[0]).toContain('Valkey unavailable');
  });

  it('keeps a lockout in memory', async () => {
    // Arrange
    await breakValkey(outage);
    const key = `pair-${randomUUID()}`;

    // Act
    const duringOutage = await outage.limiter.lockout(key);
    const stillLocked = await outage.limiter.isLocked(key);

    // Assert
    expect(duringOutage).toEqual({ locked: true, retryAfterSeconds: 60 });
    expect(stillLocked.locked).toBe(true);
  });
});
