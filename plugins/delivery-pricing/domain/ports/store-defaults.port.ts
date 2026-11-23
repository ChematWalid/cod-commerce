import type { Snowflake, StoreId } from '@cod/shared';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/**
 * Which fee group a store uses by default: tenancy's `StoreSettings.defaultDeliveryFeeGroupId`, written through its
 * `StoreDeliveryDefaults` and listed through its store directory (D3111).
 */
export interface StoreDefaultsPort {
  /** The store's default fee group id, or `null` when it has none (or the store is not the scope's). */
  defaultGroupOf(ctx: OperationContext, scope: StoreScope): Promise<Snowflake | null>;
  /**
   * The store's default fee group id (`null` when none is linked), its store row locked `FOR UPDATE` until the
   * transaction `ctx` carries ends, so a merchant's concurrent link cannot be overwritten (D3112).
   */
  lockedDefaultGroupOf(ctx: OperationContext, scope: StoreScope): Promise<Snowflake | null>;
  /**
   * Makes `groupId` the store's default, in the transaction `ctx` carries; tenancy re-checks the group is the store's.
   * Platform code only: the store-creation hook and the migrate converge (D3112).
   */
  linkDefaultGroup(ctx: OperationContext, scope: StoreScope, groupId: Snowflake): Promise<void>;
  /**
   * The scopes of up to `limit` active stores of every business with an id above `afterStoreId`, in ascending id
   * order; a page may hold fewer than `limit` (tenancy caps it), so only an empty page means the end. The converge
   * reads each store's default under its lock, never from this page (D3112).
   */
  activeStores(ctx: OperationContext, afterStoreId: StoreId | undefined, limit: number): Promise<readonly StoreScope[]>;
}
