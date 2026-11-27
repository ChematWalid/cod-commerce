import type { StoreId, TenantScope } from '@cod/shared';

/** A business and one of its stores: a fee group, its wilaya rows and its commune rows all belong to one store. */
export interface StoreScope extends TenantScope {
  readonly storeId: StoreId;
}
