import { Logger } from '@vendure/core';
import { Redis, type RedisOptions } from 'ioredis';
import { LOGGER_CONTEXT, PROBE_TIMEOUT_MS, REDIS_ERROR_LOG_INTERVAL_MS } from '../domain/constants';
import type { ReadinessProbe } from '../domain/readiness';

/** The part of a Vendure-style logger this module uses; the static Vendure `Logger` satisfies it. */
export interface WarnLogger {
  warn(message: string, context?: string): void;
}

/**
 * A probe must fail fast, never queue: commands fail at once while the client is disconnected, and a
 * command gets one retry. The client connects on the first check, not at construction.
 */
const PROBE_CLIENT_OPTIONS: RedisOptions = { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 };

/** ioredis statuses from which `connect()` starts a new connection instead of rejecting. */
const CONNECTABLE_STATUSES: readonly string[] = ['wait', 'end'];

function rateLimitedWarning(logger: WarnLogger): (error: Error) => void {
  let lastWarnedAt = Number.NEGATIVE_INFINITY;
  return (error) => {
    const now = Date.now();
    // The client retries every few hundred ms while Valkey is down; one warning per interval is enough.
    if (now - lastWarnedAt < REDIS_ERROR_LOG_INTERVAL_MS) {
      return;
    }
    lastWarnedAt = now;
    logger.warn(`Valkey health client error: ${error.message}`, LOGGER_CONTEXT);
  };
}

/**
 * Creates the dedicated Valkey client of the health probes, separate from BullMQ's and the cache's, so a
 * probe never waits behind their traffic. Its `'error'` events are logged, rate-limited.
 */
export function createProbeRedisClient(redisUrl: string, logger: WarnLogger = Logger): Redis {
  const client = new Redis(redisUrl, PROBE_CLIENT_OPTIONS);
  client.on('error', rateLimitedWarning(logger));
  return client;
}

/**
 * Connects a lazy client that has not connected yet, or that was disconnected. While ioredis is already
 * (re)connecting it returns at once, and the next command fails fast because the offline queue is off.
 */
export async function ensureConnected(client: Redis): Promise<void> {
  if (CONNECTABLE_STATUSES.includes(client.status)) {
    await client.connect();
  }
}

/** Ready when Valkey answers `PING`. */
export class RedisProbe implements ReadinessProbe {
  readonly name = 'redis';
  readonly timeoutMs = PROBE_TIMEOUT_MS.redis;

  constructor(private readonly client: Redis) {}

  async check(): Promise<void> {
    await ensureConnected(this.client);
    await this.client.ping();
  }
}
