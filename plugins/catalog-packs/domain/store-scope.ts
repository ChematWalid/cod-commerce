import type { StoreId, TenantScope } from '@cod/shared';

/** A business and one of its stores: a pack, its components and its product all belong to one store. */
export interface StoreScope extends TenantScope {
  readonly storeId: StoreId;
}
