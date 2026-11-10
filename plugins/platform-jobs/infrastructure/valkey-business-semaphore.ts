import { randomUUID } from 'node:crypto';
import type { PlatformClock } from '../domain/clock.port';
import { SEMAPHORE_LEASE_MS } from '../domain/constants';
import { SemaphoreBusyError } from '../domain/errors';
import { BusinessSemaphore, type SemaphoreKey, semaphoreRetryDelayMs } from '../domain/semaphore';
import { LEASE_TAKEN } from './semaphore-scripts';
import type { PlatformValkey } from './valkey-client';

/** Options of {@link ValkeyBusinessSemaphore}. */
export interface ValkeySemaphoreOptions {
  /** `APP_ENV`, the first part of every key. */
  readonly appEnv: string;
  readonly clock: PlatformClock;
  /** Draws the retry delay; `Math.random` by default. */
  readonly random?: () => number;
}

/** Leases in a Valkey sorted set at `{APP_ENV}:sem:{queue}:b:{businessId}`, taken by one script (D100). */
export class ValkeyBusinessSemaphore extends BusinessSemaphore {
  private readonly random: () => number;

  constructor(
    private readonly valkey: PlatformValkey,
    private readonly options: ValkeySemaphoreOptions,
  ) {
    super();
    this.random = options.random ?? Math.random;
  }

  async withBusinessSemaphore<T>(key: SemaphoreKey, limit: number, work: () => Promise<T>): Promise<T> {
    const leaseKey = `${this.options.appEnv}:sem:${key.queue}:b:${key.businessId}`;
    const token = randomUUID();
    const taken = await this.valkey.run((redis) =>
      redis.semAcquire(leaseKey, this.options.clock.now(), limit, SEMAPHORE_LEASE_MS, token),
    );
    // `undefined`: Valkey is unavailable and the semaphore fails open, with no lease to release.
    if (taken === undefined) return work();
    if (taken !== LEASE_TAKEN) throw new SemaphoreBusyError(semaphoreRetryDelayMs(this.random));
    try {
      return await work();
    } finally {
      await this.valkey.runCleanup((redis) => redis.zrem(leaseKey, token));
    }
  }
}
