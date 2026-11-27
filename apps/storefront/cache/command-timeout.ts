import { CACHE_COMMAND_TIMEOUT_MS } from './constants';
import type { CacheRedisClient, CacheRedisTransaction, SortedSetMember } from './redis-connection';

/** A cache command took longer than {@link CACHE_COMMAND_TIMEOUT_MS}; the handlers treat it as a miss (#121). */
export class CacheCommandTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`a cache command took longer than ${String(timeoutMs)} ms`);
    this.name = 'CacheCommandTimeoutError';
  }
}

/** Races `command` against `timeoutMs`. The command itself keeps running; its late answer is ignored. */
function withTimeout<T>(command: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new CacheCommandTimeoutError(timeoutMs));
    }, timeoutMs);
    // unref: this timer never keeps the process alive.
    timer.unref();
  });
  return Promise.race([command, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/** A `MULTI` block whose `exec` is bounded like every other command. */
function boundedTransaction(inner: CacheRedisTransaction, timeoutMs: number): CacheRedisTransaction {
  let queued = inner;
  const bounded: CacheRedisTransaction = {
    zAdd(key: string, member: SortedSetMember) {
      queued = queued.zAdd(key, member);
      return bounded;
    },
    zRemRangeByScore(key: string, min: number | string, max: number | string) {
      queued = queued.zRemRangeByScore(key, min, max);
      return bounded;
    },
    zRem(key: string, members: string | string[]) {
      queued = queued.zRem(key, members);
      return bounded;
    },
    del(keys: string | string[]) {
      queued = queued.del(keys);
      return bounded;
    },
    expire(key: string, seconds: number) {
      queued = queued.expire(key, seconds);
      return bounded;
    },
    exec: () => withTimeout(queued.exec(), timeoutMs),
  };
  return bounded;
}

/**
 * Wraps a client so every command settles within `timeoutMs`, rejecting with {@link CacheCommandTimeoutError}
 * otherwise: a Valkey that accepts the connection but never answers degrades to misses instead of hanging renders.
 */
export function withCommandTimeout(
  client: CacheRedisClient,
  timeoutMs: number = CACHE_COMMAND_TIMEOUT_MS,
): CacheRedisClient {
  return {
    get: (key) => withTimeout(client.get(key), timeoutMs),
    set: (key, value, options) => withTimeout(client.set(key, value, options), timeoutMs),
    del: (keys) => withTimeout(client.del(keys), timeoutMs),
    zRange: (key, start, stop) => withTimeout(client.zRange(key, start, stop), timeoutMs),
    mGet: (keys) => withTimeout(client.mGet(keys), timeoutMs),
    info: (section) => withTimeout(client.info(section), timeoutMs),
    multi: () => boundedTransaction(client.multi(), timeoutMs),
  };
}

/** The handlers' client, every command bounded, or `null` while Valkey is unreachable or during `next build`. */
export async function boundedClientOf(
  getClient: () => Promise<CacheRedisClient | null>,
): Promise<CacheRedisClient | null> {
  const client = await getClient();
  return client === null ? null : withCommandTimeout(client);
}
