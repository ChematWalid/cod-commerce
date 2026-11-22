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
