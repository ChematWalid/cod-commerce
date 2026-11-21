import type { StoreId, TenantScope } from '@cod/shared';

/** A business and one of its stores: every import, export and product origin belongs to one store. */
export interface StoreScope extends TenantScope {
  readonly storeId: StoreId;
}
