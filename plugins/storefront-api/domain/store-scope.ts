import type { BusinessId, StoreId } from '@cod/shared';

/** The store a projection read or write is for, with its business: every repository call is confined to both. */
export interface StoreScope {
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
}
