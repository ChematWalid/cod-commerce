import type { BusinessId, Snowflake, StoreId } from '@cod/shared';
import type { CoreId } from './core-id';

/**
 * One image of the business's media library (D2113): the Vendure asset holds the file, this row says which business
 * owns it and which store uploaded it, which is what store-restricted members are narrowed by (D2132).
 */
export interface MediaItem {
  readonly id: Snowflake;
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
  readonly assetId: CoreId;
  readonly createdAt: Date;
}
