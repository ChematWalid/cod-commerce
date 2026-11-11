import { createClient } from 'redis';
import { processCacheConfig } from './cache-config';

/** The message of anything thrown, for log lines. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

// disableOfflineQueue: commands fail at once while the connection is down instead of queueing until it is back.
const newRedisClient = (url: string) => createClient({ url, disableOfflineQueue: true });

/** A `redis@6.3.1` client as {@link openLazyRedisConnection} creates it. */
export type LazyRedisClient = ReturnType<typeof newRedisClient>;

/** A client whose first connection attempt is under way. */
export interface LazyRedisConnection {
  readonly client: LazyRedisClient;
  /** Settles (never rejects) once the first connection attempt is over; the client keeps reconnecting. */
  readonly connected: Promise<void>;
}

/** Writes one log line for a client problem: `client_error` or `connect_failed`. */
export type RedisProblemLogger = (event: 'client_error' | 'connect_failed', error: unknown) => void;

/**
 * Opens a client to `REDIS_URL` and starts connecting. Shared by the cache handlers and the readiness probe,
 * which keep separate clients so a cache connection problem cannot hide from `/readyz`.
 *
 * @throws CacheConfigError when `REDIS_URL` is missing outside development
 */
export function openLazyRedisConnection(log: RedisProblemLogger): LazyRedisConnection {
  const client = newRedisClient(processCacheConfig().redisUrl);
  const errors = createDistinctErrorLogger((error) => {
    log('client_error', error);
  });
  // Never throw from the error listener: the client would stop reconnecting.
  client.on('error', errors.log);
  client.on('ready', errors.reset);
  const connected = client.connect().then(
    () => undefined,
    (error: unknown) => {
      log('connect_failed', error);
    },
  );
  return { client, connected };
}
