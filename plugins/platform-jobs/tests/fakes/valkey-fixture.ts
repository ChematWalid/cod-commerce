import { randomUUID } from 'node:crypto';
import { createPlatformRedis, type PlatformRedis, PlatformValkey } from '../../infrastructure/valkey-client';
import { ManualClock } from './manual-clock';

/** The Valkey database of these suites: never flushed, each test deletes only its own keys (plan, Global Constraints). */
const TEST_DATABASE = '12';

/** `REDIS_URL` pointed at database 12. */
export function testValkeyUrl(): string {
  const url = new URL(process.env['REDIS_URL'] ?? 'redis://localhost:6380');
  url.pathname = `/${TEST_DATABASE}`;
  return url.toString();
}

/** One client, its outage guard, a manual clock and a key prefix no other test uses. */
export interface ValkeyFixture {
  readonly redis: PlatformRedis;
  readonly valkey: PlatformValkey;
  readonly clock: ManualClock;
  readonly appEnv: string;
  readonly errors: string[];
}

/** Connects to `url` (database 12 by default) and waits for the connection, or for the startup wait to end. */
export async function connectFixture(url = testValkeyUrl()): Promise<ValkeyFixture> {
  const clock = new ManualClock();
  const errors: string[] = [];
  const redis = createPlatformRedis(url);
  const valkey = new PlatformValkey(redis, { clock, logger: { error: (message) => errors.push(message) } });
  await valkey.onApplicationBootstrap();
  return { redis, valkey, clock, appEnv: `test-${randomUUID()}`, errors };
}

/** Deletes the fixture's keys and closes its client. */
export async function releaseFixture(fixture: ValkeyFixture): Promise<void> {
  if (fixture.redis.status === 'ready') {
    const keys = await fixture.redis.keys(`${fixture.appEnv}:*`);
    if (keys.length > 0) await fixture.redis.del(...keys);
  }
  fixture.redis.disconnect();
}

/** A unit of work a test starts, observes and ends by hand. */
export interface HeldWork<T> {
  readonly started: Promise<void>;
  readonly calls: () => number;
  readonly work: () => Promise<T>;
  finish(value: T): void;
  fail(error: Error): void;
}

/** Work that signals when it starts and settles only when the test says so. */
export function heldWork<T>(): HeldWork<T> {
  let calls = 0;
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  let settle: { resolve: (value: T) => void; reject: (error: Error) => void } | undefined;
  const outcome = new Promise<T>((resolve, reject) => {
    settle = { resolve, reject };
  });
  return {
    started,
    calls: () => calls,
    work: () => {
      calls += 1;
      markStarted();
      return outcome;
    },
    finish: (value) => settle?.resolve(value),
    fail: (error) => settle?.reject(error),
  };
}
