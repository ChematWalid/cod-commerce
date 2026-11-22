import type { HealthCheckResult } from '@cod/shared';
import {
  createDistinctErrorLogger,
  errorMessage,
  type LazyRedisConnection,
  openLazyRedisConnection,
} from '../../cache/lazy-redis-client';

/** How long `/readyz` waits for Valkey's `PONG`. */
export const READINESS_PING_TIMEOUT_MS = 500;

/** The reason `/readyz` gives for a failed check: a fixed code, never the error text (#184). */
export const CACHE_UNREACHABLE_REASON = 'cache_unreachable';

/** The `redis` check of `/readyz`. A failure carries {@link CACHE_UNREACHABLE_REASON}; the error itself is logged. */
export interface StorefrontRedisCheck extends HealthCheckResult {
  readonly reason?: typeof CACHE_UNREACHABLE_REASON;
}

/** Asks Valkey for a `PONG`; rejects when it cannot. */
export type RedisProbe = () => Promise<unknown>;

/** The `PING` did not answer within its timeout. */
export class RedisPingTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`PING timed out after ${String(timeoutMs)} ms`);
    this.name = 'RedisPingTimeoutError';
  }
}

/** Records the outcome of each readiness `PING`. */
export interface PingOutcomeLog {
  readonly failed: (error: unknown) => void;
  readonly succeeded: () => void;
}

/**
 * The orchestrator probes `/readyz` every few seconds, so while Valkey is down a log line per probe would
 * flood the log: a failure is logged when its message changes (the first one included), and the first
 * success after a failure is logged once as the recovery.
 */
export function createPingOutcomeLog(
  writeFailure: (error: unknown) => void,
  writeRecovery: () => void,
): PingOutcomeLog {
  const failures = createDistinctErrorLogger(writeFailure);
  let failing = false;
  return {
    failed: (error) => {
      failing = true;
      failures.log(error);
    },
    succeeded: () => {
      if (!failing) return;
      failing = false;
      failures.reset();
      writeRecovery();
    },
  };
}

let connection: LazyRedisConnection | null = null;

function logPingFailure(event: string, error: unknown): void {
  console.warn(JSON.stringify({ level: 'warn', event: `storefront.readyz.${event}`, error: errorMessage(error) }));
}

const pingOutcomes = createPingOutcomeLog(
  (error) => {
    logPingFailure('redis_ping_failed', error);
  },
  () => {
    console.info(JSON.stringify({ level: 'info', event: 'storefront.readyz.redis_ping_recovered' }));
  },
);

function rejectAfter(timeoutMs: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new RedisPingTimeoutError(timeoutMs));
    }, timeoutMs).unref();
  });
}

// Its own client, apart from the cache's, so a cache connection problem cannot hide here.
function pingSharedConnection(): Promise<unknown> {
  connection ??= openLazyRedisConnection(logPingFailure);
  const { client, connected } = connection;
  return connected.then(() => client.ping());
}

/**
 * Runs `probe` (by default a `PING` through a lazily opened client) against `timeoutMs`. Never throws. The
 * body goes to anonymous callers, so a failure reports only {@link CACHE_UNREACHABLE_REASON}: the error text
 * (which can name hosts or users) is logged instead.
 */
export async function pingRedis(
  probe: RedisProbe = pingSharedConnection,
  timeoutMs: number = READINESS_PING_TIMEOUT_MS,
): Promise<StorefrontRedisCheck> {
  const startedAt = performance.now();
  const elapsed = (): number => Math.round(performance.now() - startedAt);
  try {
    await Promise.race([probe(), rejectAfter(timeoutMs)]);
    pingOutcomes.succeeded();
    return { ok: true, durationMs: elapsed() };
  } catch (error) {
    pingOutcomes.failed(error);
    return { ok: false, durationMs: elapsed(), reason: CACHE_UNREACHABLE_REASON };
  }
}
