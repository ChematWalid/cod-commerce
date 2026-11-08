import type { HealthCheckResult } from '@cod/shared';
import { createClient } from 'redis';
import { readCacheConfig } from '../../cache/cache-config';
import { createDistinctErrorLogger, errorMessage } from '../../cache/redis-connection';

/** How long `/readyz` waits for Valkey's `PONG`. */
export const READINESS_PING_TIMEOUT_MS = 500;

/** The `PING` did not answer within its timeout. */
export class RedisPingTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`PING timed out after ${String(timeoutMs)} ms`);
    this.name = 'RedisPingTimeoutError';
  }
}

// disableOfflineQueue: a PING while disconnected fails at once instead of waiting for the reconnect.
const newPingClient = (url: string) => createClient({ url, disableOfflineQueue: true });

interface PingConnection {
  readonly client: ReturnType<typeof newPingClient>;
  /** Settles (never rejects) once the first connection attempt is over. */
  readonly connected: Promise<void>;
}

let connection: PingConnection | null = null;

function logPingFailure(event: string, error: unknown): void {
  console.warn(JSON.stringify({ level: 'warn', event: `storefront.readyz.${event}`, error: errorMessage(error) }));
}

// The probe has its own client, apart from the cache's, so a cache connection problem cannot hide here.
function openPingConnection(): PingConnection {
  const client = newPingClient(readCacheConfig(process.env).redisUrl);
  const errors = createDistinctErrorLogger((error) => {
    logPingFailure('redis_client_error', error);
  });
  client.on('error', errors.log);
  client.on('ready', errors.reset);
  const connected = client.connect().then(
    () => undefined,
    (error: unknown) => {
      logPingFailure('redis_connect_failed', error);
    },
  );
  return { client, connected };
}

function rejectAfter(timeoutMs: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new RedisPingTimeoutError(timeoutMs));
    }, timeoutMs).unref();
  });
}

/** Pings Valkey through a lazily opened client, racing the `PONG` against `timeoutMs`. Never throws. */
export async function pingRedis(timeoutMs: number = READINESS_PING_TIMEOUT_MS): Promise<HealthCheckResult> {
  const startedAt = performance.now();
  const elapsed = (): number => Math.round(performance.now() - startedAt);
  try {
    connection ??= openPingConnection();
    const { client, connected } = connection;
    await Promise.race([connected.then(() => client.ping()), rejectAfter(timeoutMs)]);
    return { ok: true, durationMs: elapsed() };
  } catch (error) {
    logPingFailure('redis_ping_failed', error);
    return { ok: false, durationMs: elapsed(), error: errorMessage(error) };
  }
}
