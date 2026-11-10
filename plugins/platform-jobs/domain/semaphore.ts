import type { BusinessId, QueueName } from '@cod/shared';
import { SEMAPHORE_RETRY_MAX_MS, SEMAPHORE_RETRY_MIN_MS } from './constants';

/** One business's jobs on one queue: the scope of a semaphore. */
export interface SemaphoreKey {
  readonly queue: QueueName;
  readonly businessId: BusinessId;
}

/**
 * Limits how many jobs of one business run at once on a queue, so one busy merchant cannot fill a pool (D100).
 * Throws `SemaphoreBusyError` when the business is at its limit; the caller re-queues the job.
 */
export abstract class BusinessSemaphore {
  /** Runs `work` while holding one of `limit` leases of `key`, and releases it however `work` ends. */
  abstract withBusinessSemaphore<T>(key: SemaphoreKey, limit: number, work: () => Promise<T>): Promise<T>;
}

/** A delay drawn uniformly from 5 s to 30 s, both included; `random` returns a number in [0, 1). */
export function semaphoreRetryDelayMs(random: () => number): number {
  const span = SEMAPHORE_RETRY_MAX_MS - SEMAPHORE_RETRY_MIN_MS + 1;
  return SEMAPHORE_RETRY_MIN_MS + Math.floor(random() * span);
}
