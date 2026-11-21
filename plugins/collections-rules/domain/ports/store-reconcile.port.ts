import type { StoreScope } from '../store-scope';

/**
 * Why a store's automatic collections are rebuilt (D2336): a save over the synchronous cap, a delivery's last failed
 * attempt, a normal form or rule version change found at bootstrap, or the nightly sweep.
 */
export const RECONCILE_REASONS = ['save', 'delivery', 'version', 'nightly'] as const;

/** One of the {@link RECONCILE_REASONS}. */
export type ReconcileReason = (typeof RECONCILE_REASONS)[number];

/** Queues the store reconcile job `collections.recompute-store` (D2336); the job runs later, on the bulk pool. */
export interface StoreReconcileQueuePort {
  enqueue(scope: StoreScope, reason: ReconcileReason): Promise<void>;
}
