import type { StoreScope } from '../store-scope';

/** Queues the rebuild of a store's whole projection, out of the delivery that asked for it. */
export interface ProjectionRebuildQueuePort {
  /** `key` is unique per cause (an outbox id): a repeat of the same cause is one rebuild. */
  enqueue(scope: StoreScope, key: string): Promise<void>;
}
