import type { StoreId } from '@cod/shared';

/** A store whose public host data just changed. `subdomains` lists every host label that may be stale. */
export interface StoreHostChange {
  readonly storeId: StoreId;
  readonly subdomains: readonly string[];
}

/** Forgets what is cached about a store's hosts. Called after the change has committed. */
export interface StoreHostInvalidatorPort {
  invalidate(change: StoreHostChange): Promise<void>;
}
