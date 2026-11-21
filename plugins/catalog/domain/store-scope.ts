import type { StoreId, TenantScope } from '@cod/shared';

/**
 * A business and one of its stores. Brands, tags, highlights and product settings belong to one store: every lookup
 * names both, so an id of the business's other store answers "not found" like a foreign one.
 */
export interface StoreScope extends TenantScope {
  readonly storeId: StoreId;
}
