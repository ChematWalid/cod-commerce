import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { createClient } from 'redis';
import { readCacheConfig } from './cache-config';
import { CACHE_ENTRY_MAX_TTL_SECONDS, CACHE_ENTRY_MIN_TTL_SECONDS, CONNECT_TIMEOUT_MS } from './constants';

/** The `SET` options the cache handlers use: every key gets a TTL. */
export interface CacheSetOptions {
  readonly expiration: { readonly type: 'EX'; readonly value: number };
}

/** The subset of the `redis@6.3.1` client the cache handlers use; tests pass a fake. */
export interface CacheRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: CacheSetOptions): Promise<unknown>;
  del(keys: string | string[]): Promise<number>;
  sAdd(key: string, members: string | string[]): Promise<number>;
  sMembers(key: string): Promise<string[]>;
  mGet(keys: string[]): Promise<(string | null)[]>;
  expire(key: string, seconds: number): Promise<number>;
}

/** What both cache handler factories take, so tests can pass a fake client and any deployment id. */
export interface CacheHandlerDeps {
  readonly getClient: () => Promise<CacheRedisClient | null>;
  readonly deploymentId: string;
}

/**
 * A tag revalidation could not reach Valkey. It is thrown, never swallowed: once Valkey is back, every
 * instance would otherwise serve the old entries again.
 */
export class CacheUnavailableError extends Error {
  constructor(message = 'Valkey is unavailable, so the tag revalidation was not recorded') {
    super(message);
    this.name = 'CacheUnavailableError';
  }
}

/**
 * The `SET` options of an entry: its own finite `expire` (never `revalidate`: past it the entry is only stale
 * and still served while it refreshes), capped at {@link CACHE_ENTRY_MAX_TTL_SECONDS}. An entry without a
 * finite `expire` gets the cap, so no key outlives 6 h in the shared `noeviction` Valkey.
 */
export function cacheSetOptions(expireSeconds: number | undefined): CacheSetOptions {
  const ttl =
    expireSeconds !== undefined && Number.isFinite(expireSeconds)
      ? Math.max(CACHE_ENTRY_MIN_TTL_SECONDS, Math.ceil(expireSeconds))
      : CACHE_ENTRY_MAX_TTL_SECONDS;
  return { expiration: { type: 'EX', value: Math.min(ttl, CACHE_ENTRY_MAX_TTL_SECONDS) } };
}

// disableOfflineQueue: commands fail at once while the connection is down instead of queueing until it is back.
const newRedisClient = (url: string) => createClient({ url, disableOfflineQueue: true });

type RedisClient = ReturnType<typeof newRedisClient>;

interface LazyConnection {
  readonly client: RedisClient;
  /** Settles once connected or after {@link CONNECT_TIMEOUT_MS}, whichever comes first. */
  readonly ready: Promise<void>;
}

let connection: LazyConnection | null = null;

/** The message of anything thrown, for log lines. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Logs a cache problem as one JSON line; the cache degrades to misses, so this is a warning. */
export function logCacheWarning(event: string, error: unknown): void {
  console.warn(JSON.stringify({ level: 'warn', event: `storefront.cache.${event}`, error: errorMessage(error) }));
}

/** Logs a client's `error` events, each distinct message once until `reset` (call it on `ready`). */
export interface DistinctErrorLogger {
  readonly log: (error: unknown) => void;
  readonly reset: () => void;
}

/**
 * A logger for a client's `error` events: the client emits one on every reconnect attempt while Valkey is
 * down, so each distinct message is logged once, and again after the next successful connection.
 */
export function createDistinctErrorLogger(write: (error: unknown) => void): DistinctErrorLogger {
  let last: string | null = null;
  return {
    log: (error) => {
      const message = errorMessage(error);
      if (message === last) return;
      last = message;
      write(error);
    },
    reset: () => {
      last = null;
    },
  };
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    // unref: this timer never keeps the process alive.
    setTimeout(resolve, ms).unref();
  });

function openConnection(): LazyConnection {
  const client = newRedisClient(readCacheConfig(process.env).redisUrl);
  const errors = createDistinctErrorLogger((error) => {
    logCacheWarning('client_error', error);
  });
  // Never throw from the error listener: the client would stop reconnecting.
  client.on('error', errors.log);
  client.on('ready', errors.reset);
  const connected = client.connect().then(
    () => undefined,
    (error: unknown) => {
      logCacheWarning('connect_failed', error);
    },
  );
  return { client, ready: Promise.race([connected, delay(CONNECT_TIMEOUT_MS)]) };
}

/**
 * The shared cache client, or `null` while Valkey is unreachable (the storefront then serves uncached) and
 * during `next build` (no connection is opened at build time). The first call opens the connection and waits
 * for it at most {@link CONNECT_TIMEOUT_MS}; the client keeps reconnecting in the background.
 */
export async function getCacheRedisClient(): Promise<CacheRedisClient | null> {
  if (process.env['NEXT_PHASE'] === PHASE_PRODUCTION_BUILD) return null;
  connection ??= openConnection();
  await connection.ready;
  return connection.client.isReady ? connection.client : null;
}
