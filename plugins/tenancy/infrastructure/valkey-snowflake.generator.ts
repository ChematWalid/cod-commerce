import { randomUUID } from 'node:crypto';
import { ClockMovedBackwardsError, LEASED_WORKER_ID_MAX, type Snowflake, SnowflakeGenerator } from '@cod/shared';
import type { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Logger } from '@vendure/core';
import type { Redis } from 'ioredis';
import { WORKER_LEASE_RENEW_MS, WORKER_LEASE_TTL_MS, workerLeaseKey } from '../domain/constants';
import { IdGeneratorNotReadyError, NoWorkerIdAvailableError } from '../domain/errors';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';

const LOG_CONTEXT = 'ValkeySnowflakeGenerator';

/** Renews the key only while this instance still owns it, so a lost lease is never taken back. */
const RENEW_IF_OWNED = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end`;

/** Deletes the key only while this instance still owns it. */
const RELEASE_IF_OWNED = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

/** Which worker ids an instance may use. */
export interface WorkerIdOptions {
  readonly firstWorkerId?: number;
  readonly lastWorkerId?: number;
  /** Uses this id without a lease: tests and scripts only, from the reserved range. */
  readonly pinnedWorkerId?: number;
  readonly now?: () => number;
}

interface WorkerLease {
  readonly workerId: number;
  readonly generator: SnowflakeGenerator;
  expiresAt: number;
}

/**
 * The ADR 0003 generator: a worker id leased from Valkey, renewed in the background. A process without a live
 * lease refuses to make ids rather than risk a duplicate. Boot does not depend on Valkey: an unreachable Valkey
 * is logged and retried, so `/readyz` can report it instead of the process failing to start.
 */
export class ValkeySnowflakeGenerator implements IdGeneratorPort, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly instance = randomUUID();
  private readonly firstWorkerId: number;
  private readonly lastWorkerId: number;
  private readonly now: () => number;
  private lease: WorkerLease | undefined;
  private renewal: NodeJS.Timeout | undefined;

  constructor(
    private readonly redis: Redis,
    private readonly options: WorkerIdOptions = {},
  ) {
    this.firstWorkerId = options.firstWorkerId ?? 0;
    this.lastWorkerId = options.lastWorkerId ?? LEASED_WORKER_ID_MAX;
    this.now = options.now ?? Date.now;
  }

  /** The worker id in use, or `undefined` without a lease. */
  get workerId(): number | undefined {
    return this.lease?.workerId;
  }

  /**
   * @throws {IdGeneratorNotReadyError} without a live lease.
   * @throws {ClockMovedBackwardsError} when the clock jumped back too far; the lease is given up and re-taken.
   */
  next(): Snowflake {
    const lease = this.lease;
    if (lease === undefined || this.now() >= lease.expiresAt) {
      throw new IdGeneratorNotReadyError();
    }
    try {
      return lease.generator.next();
    } catch (error) {
      if (error instanceof ClockMovedBackwardsError) {
        this.relinquish();
      }
      throw error;
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.options.pinnedWorkerId !== undefined) {
      this.lease = this.leaseOn(this.options.pinnedWorkerId, Number.POSITIVE_INFINITY);
      return;
    }
    await this.acquireLogged();
    this.renewal = setInterval(() => void this.renew(), WORKER_LEASE_RENEW_MS);
    this.renewal.unref();
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.renewal);
    const lease = this.lease;
    this.lease = undefined;
    if (lease !== undefined && this.options.pinnedWorkerId === undefined) {
      await this.release(lease.workerId);
    }
    this.redis.disconnect();
  }

  /** One renewal step; public so tests need not wait for the timer. */
  async renew(): Promise<void> {
    const lease = this.lease;
    if (lease === undefined) {
      await this.acquireLogged();
      return;
    }
    try {
      const renewed = await this.redis.eval(
        RENEW_IF_OWNED,
        1,
        workerLeaseKey(lease.workerId),
        this.instance,
        WORKER_LEASE_TTL_MS,
      );
      if (renewed === 1) {
        lease.expiresAt = this.now() + WORKER_LEASE_TTL_MS;
        return;
      }
      Logger.warn(`Lost the lease on worker id ${String(lease.workerId)}`, LOG_CONTEXT);
      this.lease = undefined;
      await this.acquireLogged();
    } catch (error) {
      // The lease stays usable until it expires: next() checks expiresAt, and Valkey may be back by then.
      Logger.error(`Could not renew the worker id lease: ${String(error)}`, LOG_CONTEXT);
    }
  }

  private relinquish(): void {
    const lease = this.lease;
    this.lease = undefined;
    if (lease !== undefined && this.options.pinnedWorkerId === undefined) {
      void this.release(lease.workerId).then(() => this.acquireLogged());
    }
  }

  private async release(workerId: number): Promise<void> {
    try {
      await this.redis.eval(RELEASE_IF_OWNED, 1, workerLeaseKey(workerId), this.instance);
    } catch (error) {
      // It expires by itself within the TTL.
      Logger.warn(`Could not release worker id ${String(workerId)}: ${String(error)}`, LOG_CONTEXT);
    }
  }

  private async acquireLogged(): Promise<void> {
    try {
      this.lease = await this.acquire();
      Logger.info(`Leased snowflake worker id ${String(this.lease.workerId)}`, LOG_CONTEXT);
    } catch (error) {
      Logger.error(`Could not lease a snowflake worker id: ${String(error)}`, LOG_CONTEXT);
    }
  }

  private async acquire(): Promise<WorkerLease> {
    for (let workerId = this.firstWorkerId; workerId <= this.lastWorkerId; workerId += 1) {
      const taken = await this.redis.set(workerLeaseKey(workerId), this.instance, 'PX', WORKER_LEASE_TTL_MS, 'NX');
      if (taken === 'OK') {
        return this.leaseOn(workerId, this.now() + WORKER_LEASE_TTL_MS);
      }
    }
    throw new NoWorkerIdAvailableError();
  }

  private leaseOn(workerId: number, expiresAt: number): WorkerLease {
    return { workerId, generator: new SnowflakeGenerator(workerId), expiresAt };
  }
}
