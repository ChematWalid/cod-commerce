import type { Snowflake } from '@cod/shared';
import type { Business } from '../business';
import type { Store } from '../store';
import type { OperationContext } from './operation-context';

/** The owner links of a business, set as provisioning makes them. */
export interface BusinessOwnerPatch {
  readonly ownerRoleId?: number;
  readonly ownerAdministratorId?: number;
}

/** Platform-level access to business and store rows, unscoped because no tenant exists yet (A7). */
export interface PlatformStorePort {
  saveBusiness(ctx: OperationContext, business: Business): Promise<void>;
  findBusiness(ctx: OperationContext, id: Snowflake): Promise<Business | undefined>;
  updateBusinessOwner(ctx: OperationContext, id: Snowflake, patch: BusinessOwnerPatch): Promise<void>;
  createOrderSequence(ctx: OperationContext, businessId: Snowflake): Promise<void>;
  saveStore(ctx: OperationContext, store: Store): Promise<void>;
  /** True when any store, archived included, holds `subdomain` (D4). */
  isSubdomainTaken(ctx: OperationContext, subdomain: string): Promise<boolean>;
}
