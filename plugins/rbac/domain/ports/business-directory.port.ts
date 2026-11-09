import type { BusinessId, Snowflake } from '@cod/shared';
import type { BusinessStore } from '../store-access';
import type { OperationContext } from './operation-context';

/** A business to converge and the Vendure links its owner was given at provisioning. */
export interface ConvergeTarget {
  readonly id: BusinessId;
  readonly ownerRoleId: number | null;
  readonly ownerAdministratorId: number | null;
}

/** The businesses and store channels of the platform, as the converge walks them (D57). */
export interface BusinessDirectoryPort {
  /** Up to `limit` businesses with an id above `afterId` (all of them when absent), in ascending id order. */
  page(ctx: OperationContext, afterId: Snowflake | undefined, limit: number): Promise<readonly ConvergeTarget[]>;
  /** Every store of the business, archived ones too: the caller decides what counts. */
  stores(ctx: OperationContext, businessId: BusinessId): Promise<readonly BusinessStore[]>;
  /** The administrator the business was provisioned for, or `null`. */
  ownerAdministratorOf(ctx: OperationContext, businessId: BusinessId): Promise<number | null>;
  /** The Vendure channel of every store of the business, archived ones too. */
  storeChannelIds(ctx: OperationContext, businessId: BusinessId): Promise<readonly number[]>;
}
