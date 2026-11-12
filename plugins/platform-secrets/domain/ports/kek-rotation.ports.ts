import type { BusinessId } from '@cod/shared';
import type { KekRewrapJobData } from '../kek-rewrap-job';
import type { DataKeyRecord } from './secret-repositories.port';

/** Finds the data keys that a rotation has not reached. It crosses businesses and returns ids only. */
export interface RetiredKekScanPort {
  /** Up to `limit` business ids, ascending and after `after`, whose data key is not wrapped by `activeKid`. */
  staleBusinesses(activeKid: string, after: string | null, limit: number): Promise<readonly string[]>;

  /** How many data keys are not wrapped by `activeKid`. */
  countStale(activeKid: string): Promise<number>;
}

/** Where rewrap jobs go. A job id already queued is not queued twice. */
export interface KekRewrapQueuePort {
  enqueue(job: KekRewrapJobData): Promise<void>;
}

/** The new wrapping of a data key. */
export interface RewrappedKey {
  readonly kid: string;
  readonly wrapped: DataKeyRecord['wrapped'];
}

/** Where a data key is re-wrapped. */
export interface KekRewrapStorePort {
  /**
   * In one transaction: locks the business's data key row (`SELECT ... FOR UPDATE`), hands it to `plan` and stores
   * what `plan` returns. `plan` returning undefined, or a business without a data key, writes nothing.
   */
  rewrapLocked(
    businessId: BusinessId,
    plan: (current: DataKeyRecord) => RewrappedKey | undefined,
    rotatedAt: Date,
  ): Promise<'rewrapped' | 'current'>;
}
