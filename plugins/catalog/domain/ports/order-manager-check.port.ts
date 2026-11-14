import type { BusinessId, Snowflake, StoreId } from '@cod/shared';
import type { OperationContext } from './operation-context';

/**
 * What the catalog asks the team plugin about team members (D2114, D2132). Team implements it in its infrastructure
 * and registers it on bootstrap; the catalog never reads team tables. Team-member ids are not administrator ids.
 */
export interface OrderManagerCheck {
  /**
   * The ids of `ids` that may not manage the orders of a product of `storeId`: no live, active member of
   * `businessId`, or one whose store access excludes `storeId`. An empty answer accepts every id.
   */
  unknownIds(
    ctx: OperationContext,
    businessId: BusinessId,
    storeId: StoreId,
    ids: readonly Snowflake[],
  ): Promise<readonly Snowflake[]>;

  /** The stores of `businessId` the caller of `ctx` reaches through its roles; `'all'` covers stores opened later. */
  accessibleStoreIds(ctx: OperationContext, businessId: BusinessId): Promise<ReadonlySet<StoreId> | 'all'>;
}

/** Where team registers its {@link OrderManagerCheck} (injected as `ORDER_MANAGER_CHECK_REGISTRAR`). */
export interface OrderManagerCheckRegistrar {
  /** @throws {Error} when a check is already registered: two checks would silently disagree. */
  register(check: OrderManagerCheck): void;
}

/** The registered check as the use cases read it: `undefined` while no team check is registered. */
export interface OrderManagerCheckSource {
  current(): OrderManagerCheck | undefined;
}
