import type { BusinessId, StoreId } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** A business was provisioned: its Owner role and first administrator exist, its first store was already created. */
export interface BusinessProvisionedEvent {
  readonly businessId: BusinessId;
  readonly ownerRoleId: number;
  readonly ownerAdministratorId: number;
}

/** A store was opened for a business. */
export interface StoreCreatedEvent {
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
  readonly channelId: number;
}

/**
 * What another plugin needs to run when a tenant changes shape. Both hooks are awaited inside the transaction that
 * makes the change (D56): `ctx` carries it, so a hook's writes commit with it and a throw rolls everything back.
 */
export interface TenantLifecycleHook {
  businessProvisioned(ctx: OperationContext, event: BusinessProvisionedEvent): Promise<void>;
  storeCreated(ctx: OperationContext, event: StoreCreatedEvent): Promise<void>;
}
