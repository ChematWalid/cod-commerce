import type { Snowflake } from '@cod/shared';
import type { OperationContext } from './operation-context';
import type { StoreReferenceScope } from './store-reference-check.port';

/**
 * Links a store to its default delivery fee group from platform code (D3111): delivery-pricing's store-creation hook,
 * inside the creating transaction, and its migrate converge. Never from a merchant request: `updateStore` is that path.
 * An abstract class: plugins inject it by type.
 */
export abstract class StoreDeliveryDefaults {
  /**
   * Locks `scope`'s store row `FOR UPDATE` until the transaction `ctx` carries ends and answers its default fee group
   * id (`null` when none is linked), so the converge decides on the value no merchant can change under it (D3112).
   *
   * @throws {StoreNotFoundError} when `scope`'s business has no such store.
   */
  abstract lockDefaultDeliveryFeeGroup(ctx: OperationContext, scope: StoreReferenceScope): Promise<Snowflake | null>;

  /**
   * Sets `scope`'s store's default fee group to `groupId`, in the transaction `ctx` carries.
   *
   * @throws {StoreReferenceNotFoundError} when the registered fee-group check does not confirm the group is the store's.
   * @throws {StoreNotFoundError} when `scope`'s business has no such store.
   */
  abstract setDefaultDeliveryFeeGroup(
    ctx: OperationContext,
    scope: StoreReferenceScope,
    groupId: Snowflake,
  ): Promise<void>;
}
