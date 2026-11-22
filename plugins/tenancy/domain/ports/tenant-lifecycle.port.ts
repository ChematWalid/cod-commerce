import type { BusinessId, StoreChangeKind, StoreId } from '@cod/shared';
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

/** A store's settings, status or hosts changed: what buyers see of it may be stale (D3204). */
export interface StoreChangedEvent {
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
  readonly change: StoreChangeKind;
}

/**
 * What another plugin needs to run when a tenant changes shape. Every hook is awaited inside the transaction that
 * makes the change (D56): `ctx` carries it, so a hook's writes commit with it and a throw rolls everything back.
 */
export interface TenantLifecycleHook {
  businessProvisioned(ctx: OperationContext, event: BusinessProvisionedEvent): Promise<void>;
  storeCreated(ctx: OperationContext, event: StoreCreatedEvent): Promise<void>;
  /** Optional: only the hooks that care about store changes (the outbox's `store.changed`, D3218) implement it. */
  storeChanged?(ctx: OperationContext, event: StoreChangedEvent): Promise<void>;
}
