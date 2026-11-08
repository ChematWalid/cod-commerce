import type { HealthCheckResult } from '@cod/shared';
import {
  createDistinctErrorLogger,
  errorMessage,
  type LazyRedisConnection,
  openLazyRedisConnection,
} from '../../cache/lazy-redis-client';

/** How long `/readyz` waits for Valkey's `PONG`. */
export const READINESS_PING_TIMEOUT_MS = 500;

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

/** Pings Valkey through a lazily opened client, racing the `PONG` against `timeoutMs`. Never throws. */
export async function pingRedis(timeoutMs: number = READINESS_PING_TIMEOUT_MS): Promise<HealthCheckResult> {
  const startedAt = performance.now();
  const elapsed = (): number => Math.round(performance.now() - startedAt);
  try {
    // Its own client, apart from the cache's, so a cache connection problem cannot hide here.
    connection ??= openLazyRedisConnection(logPingFailure);
    const { client, connected } = connection;
    await Promise.race([connected.then(() => client.ping()), rejectAfter(timeoutMs)]);
    pingOutcomes.succeeded();
    return { ok: true, durationMs: elapsed() };
  } catch (error) {
    pingOutcomes.failed(error);
    return { ok: false, durationMs: elapsed(), error: errorMessage(error) };
  }
}
