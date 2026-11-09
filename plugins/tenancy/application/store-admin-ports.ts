import type { StoreHostInvalidatorPort } from '../domain/ports/store-host-invalidator.port';
import type { TenantStoresPort } from '../domain/ports/tenant-stores.port';
import type { TenancyPorts } from './tenancy-ports';

/** What the store and business administration use cases run on. */
export interface StoreAdminPorts extends TenancyPorts {
  readonly stores: TenantStoresPort;
  readonly hosts: StoreHostInvalidatorPort;
}
