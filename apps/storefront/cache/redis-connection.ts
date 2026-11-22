import { inNextBuildPhase } from './cache-config';
import { CACHE_ENTRY_MAX_TTL_SECONDS, CACHE_ENTRY_MIN_TTL_SECONDS, CONNECT_TIMEOUT_MS } from './constants';
import { errorMessage, type LazyRedisClient, openLazyRedisConnection } from './lazy-redis-client';

/** The `SET` options the cache handlers use: every key gets a TTL. */
export interface CacheSetOptions {
  readonly expiration: { readonly type: 'EX'; readonly value: number };
}

/** One member of a sorted set and its score. */
export interface SortedSetMember {
  readonly score: number;
  readonly value: string;
}

/** A `MULTI` block: the queued commands run together on `exec`. */
export interface CacheRedisTransaction {
  zAdd(key: string, member: SortedSetMember): CacheRedisTransaction;
  zRemRangeByScore(key: string, min: number | string, max: number | string): CacheRedisTransaction;
  zRem(key: string, members: string | string[]): CacheRedisTransaction;
  del(keys: string | string[]): CacheRedisTransaction;
  expire(key: string, seconds: number): CacheRedisTransaction;
  exec(): Promise<unknown>;
}

/** The subset of the `redis@6.3.1` client the cache handlers use; tests pass a fake. */
export interface CacheRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: CacheSetOptions): Promise<unknown>;
  del(keys: string | string[]): Promise<number>;
  zRange(key: string, start: number, stop: number): Promise<string[]>;
  mGet(keys: string[]): Promise<(string | null)[]>;
  info(section: string): Promise<string>;
  multi(): CacheRedisTransaction;
}

/** Decides whether cache entries may be written now (the writes-off switch, ADR 0006 D4). */
export interface CacheWriteGate {
  allowsWrites(client: CacheRedisClient): Promise<boolean>;
}

/** What both cache handler factories take, so tests can pass a fake client and any deployment id. */
export interface CacheHandlerDeps {
  readonly getClient: () => Promise<CacheRedisClient | null>;
  readonly deploymentId: string;
  readonly writeGuard: CacheWriteGate;
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

interface LazyConnection {
  readonly client: LazyRedisClient;
  /** Settles once connected or after {@link CONNECT_TIMEOUT_MS}, whichever comes first. */
  readonly ready: Promise<void>;
}

let connection: LazyConnection | null = null;

/** Logs a cache problem as one JSON line; the cache degrades to misses, so this is a warning. */
export function logCacheWarning(event: string, error: unknown): void {
  logCacheEvent(event, { error: errorMessage(error) });
}

/** Logs a cache event that is not an error (an entry skipped, writes switched off) as one JSON line. */
export function logCacheEvent(event: string, fields: Readonly<Record<string, string | number | boolean>>): void {
  console.warn(JSON.stringify({ level: 'warn', event: `storefront.cache.${event}`, ...fields }));
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    // unref: this timer never keeps the process alive.
    setTimeout(resolve, ms).unref();
  });

function openConnection(): LazyConnection {
  const { client, connected } = openLazyRedisConnection(logCacheWarning);
  return { client, ready: Promise.race([connected, delay(CONNECT_TIMEOUT_MS)]) };
}

/**
 * The shared cache client, or `null` while Valkey is unreachable (the storefront then serves uncached) and
 * during `next build` (no connection is opened at build time). The first call opens the connection and waits
 * for it at most {@link CONNECT_TIMEOUT_MS}; the client keeps reconnecting in the background.
 */
export async function getCacheRedisClient(): Promise<CacheRedisClient | null> {
  if (inNextBuildPhase()) return null;
  connection ??= openConnection();
  await connection.ready;
  return connection.client.isReady ? connection.client : null;
}
