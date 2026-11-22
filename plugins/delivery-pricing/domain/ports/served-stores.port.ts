import type { StoreId } from '@cod/shared';
import type { StoreScope } from '../store-scope';

/** Finds the stores that serve buyers, for the storefront's commune narrowing (P3.S1 Task 8). */
export interface ServedStoresPort {
  /**
   * The business and store of `storeId` when it is an active store of an active business; `null` for any other id
   * (unknown, archived or suspended), which offers nothing.
   */
  scopeOf(storeId: StoreId): Promise<StoreScope | null>;
}
