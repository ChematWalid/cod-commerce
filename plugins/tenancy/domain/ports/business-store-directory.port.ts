import type { BusinessId, Snowflake } from '@cod/shared';
import type { StoreAccess } from '../store';
import type { OperationContext } from './operation-context';

/** A business and the Vendure links its owner was given at provisioning. */
export interface BusinessSummary {
  readonly id: BusinessId;
  readonly ownerRoleId: number | null;
  readonly ownerAdministratorId: number | null;
}

/**
 * A read-only view of businesses and their stores for other plugins. It is unscoped, so it never exposes more than
 * ids and links, and the caller names the business it asks about. An abstract class: plugins inject it by type.
 */
export abstract class BusinessStoreDirectory {
  /** Every store of the business, archived ones too: the caller decides what counts. */
  abstract storesOf(ctx: OperationContext, businessId: BusinessId): Promise<readonly StoreAccess[]>;

  /** Up to `limit` businesses with an id above `afterId` (all of them when absent), in ascending id order. */
  abstract allBusinessIds(
    ctx: OperationContext,
    afterId: Snowflake | undefined,
    limit: number,
  ): Promise<readonly BusinessSummary[]>;
}
