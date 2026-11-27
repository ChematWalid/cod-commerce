import type { StoreHostInvalidatorPort } from '../domain/ports/store-host-invalidator.port';
import type { TenantStoresPort } from '../domain/ports/tenant-stores.port';
import type { StoreReferenceChecks } from './store-reference.registry';
import type { TenancyPorts } from './tenancy-ports';

/** What the store and business administration use cases run on. */
export interface StoreAdminPorts extends TenancyPorts {
  readonly stores: TenantStoresPort;
  readonly hosts: StoreHostInvalidatorPort;
  /** The checks other plugins registered for the ids a store setting names (D3111). */
  readonly references: StoreReferenceChecks;
}
