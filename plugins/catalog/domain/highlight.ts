import type { BusinessId, Snowflake, StoreId } from '@cod/shared';

/** A short selling point of one store that its products may show, at most six per product (brief AC3). */
export interface Highlight {
  readonly id: Snowflake;
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
  readonly text: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
