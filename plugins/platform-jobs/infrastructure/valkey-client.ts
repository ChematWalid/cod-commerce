import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { PlatformClock } from '../domain/clock.port';
import {
  VALKEY_COMMAND_TIMEOUT_MS,
  VALKEY_ERROR_LOG_INTERVAL_MS,
  VALKEY_HUNG_SOCKET_TIMEOUTS,
  VALKEY_OUTAGE_RETRY_MS,
  VALKEY_STARTUP_WAIT_MS,
} from '../domain/constants';
import { BREAKER_ADMIT_SCRIPT, BREAKER_FAILURE_SCRIPT, BREAKER_PROBE_SUCCESS_SCRIPT } from './breaker-scripts';
import { SEMAPHORE_ACQUIRE_SCRIPT } from './semaphore-scripts';

/** The message of ioredis' `commandTimeout` rejection. */
const COMMAND_TIMED_OUT = 'Command timed out';

/** The custom commands {@link createPlatformRedis} defines on the client. */
export interface PlatformRedis extends Redis {
  semAcquire(key: string, nowMs: number, limit: number, leaseMs: number, token: string): Promise<number>;
  cbAdmit(key: string, nowMs: number, openMs: number, probeLeaseMs: number, token: string): Promise<[number, number]>;
  cbProbeSucceeded(recordKey: string, failuresKey: string, probeToken: string): Promise<number>;
  cbFailure(
    recordKey: string,
    failuresKey: string,
    nowMs: number,
    /** The probe's token, or '' for a call made while the breaker was closed. */
    probeToken: string,
    threshold: number,
    windowMs: number,
    token: string,
    recordTtlMs: number,
  ): Promise<number>;
}

/** Where Valkey faults are reported; Vendure's logger in production. */
export interface PlatformValkeyLogger {
  error(message: string): void;
}

/** Options of {@link PlatformValkey}. */
export interface PlatformValkeyOptions {
  readonly logger: PlatformValkeyLogger;
  readonly clock: PlatformClock;
}

/**
 * A client that fails fast instead of holding a job (the rate limiter's D31 pattern): no offline queue, so a
 * command sent while the socket is down is rejected at once, and a 250 ms command timeout for a socket that hangs.
 */
export function createPlatformRedis(url: string): PlatformRedis {
  const redis = new Redis(url, {
    enableOfflineQueue: false,
    commandTimeout: VALKEY_COMMAND_TIMEOUT_MS,
    maxRetriesPerRequest: 0,
    connectionName: 'platform-jobs',
  });
  redis.defineCommand('semAcquire', { numberOfKeys: 1, lua: SEMAPHORE_ACQUIRE_SCRIPT });
  redis.defineCommand('cbAdmit', { numberOfKeys: 1, lua: BREAKER_ADMIT_SCRIPT });
  redis.defineCommand('cbProbeSucceeded', { numberOfKeys: 2, lua: BREAKER_PROBE_SUCCESS_SCRIPT });
  redis.defineCommand('cbFailure', { numberOfKeys: 2, lua: BREAKER_FAILURE_SCRIPT });
  return redis as PlatformRedis;
}

/**
 * The semaphore's and the breaker's way to Valkey. A failed command answers `undefined`, which they read as
 * "fail open": system-design §10 accepts losing their state, and an outage must not stop work (D103). Faults are
 * logged at most every 30 s, and Valkey is not asked again for 2 s after one, except for cleanup commands.
 */
export class PlatformValkey implements OnApplicationBootstrap, OnApplicationShutdown {
  private retryAtMs = 0;
  private lastLoggedAtMs = Number.NEGATIVE_INFINITY;
  private suppressedErrors = 0;
  private consecutiveTimeouts = 0;

  constructor(
    private readonly redis: PlatformRedis,
    private readonly options: PlatformValkeyOptions,
  ) {
    redis.on('error', (error: Error) => {
      this.report(error);
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.redis.status === 'ready') return;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, VALKEY_STARTUP_WAIT_MS);
      this.redis.once('ready', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch((error: unknown) => {
      // Said directly: `report` could drop it as a repeat of an outage message, and it is not an outage.
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.options.logger.error(`Valkey connection did not close cleanly on shutdown; forcing it closed: ${reason}`);
      this.redis.disconnect();
    });
  }

  /**
   * Runs `command`; `undefined` means Valkey is unavailable and the caller fails open. Skipped during the
   * back-off after a failure, so an outage does not add a timeout to every job.
   */
  async run<T>(command: (redis: PlatformRedis) => Promise<T>): Promise<T | undefined> {
    if (this.options.clock.now() < this.retryAtMs) return undefined;
    return this.execute(command);
  }

  /**
   * Runs a command that undoes or settles state the caller already holds (a lease release, a probe's outcome),
   * even during the back-off: skipping it would leave a lease counting for 10 min or a probe lease for 60 s.
   */
  async runCleanup<T>(command: (redis: PlatformRedis) => Promise<T>): Promise<T | undefined> {
    return this.execute(command);
  }

  private async execute<T>(command: (redis: PlatformRedis) => Promise<T>): Promise<T | undefined> {
    try {
      const result = await command(this.redis);
      this.consecutiveTimeouts = 0;
      return result;
    } catch (error: unknown) {
      this.retryAtMs = this.options.clock.now() + VALKEY_OUTAGE_RETRY_MS;
      this.report(error);
      this.replaceHungSocket(error);
      return undefined;
    }
  }

  /**
   * A socket that stopped answering still reads as connected, so it is replaced, but only after several timeouts
   * in a row: a reconnect rejects every in-flight command, including releases and acquires Valkey already ran,
   * and one slow command is not a hung socket.
   */
  private replaceHungSocket(error: unknown): void {
    if (!(error instanceof Error) || error.message !== COMMAND_TIMED_OUT) return;
    this.consecutiveTimeouts += 1;
    if (this.consecutiveTimeouts < VALKEY_HUNG_SOCKET_TIMEOUTS || this.redis.status !== 'ready') return;
    this.consecutiveTimeouts = 0;
    this.redis.disconnect(true);
  }

  private report(error: unknown): void {
    const nowMs = this.options.clock.now();
    if (nowMs - this.lastLoggedAtMs < VALKEY_ERROR_LOG_INTERVAL_MS) {
      this.suppressedErrors += 1;
      return;
    }
    const reason = error instanceof Error ? error.message : 'unknown error';
    const repeated =
      this.suppressedErrors === 0 ? '' : ` (${String(this.suppressedErrors)} more since the last report)`;
    this.lastLoggedAtMs = nowMs;
    this.suppressedErrors = 0;
    this.options.logger.error(
      `Valkey unavailable, business semaphores and circuit breakers fail open: ${reason}${repeated}`,
    );
  }
}
