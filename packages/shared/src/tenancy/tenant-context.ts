import { type Snowflake, toSnowflake } from '../ids/snowflake';
import type { BusinessId } from './tenant-scope';

/** A store id: the snowflake id of a `Store` row (ADR 0003). */
export type StoreId = Snowflake & { readonly __storeBrand: 'StoreId' };

/**
 * Validates and brands a store id.
 *
 * @throws {@link InvalidSnowflakeError} when `value` is not a valid snowflake
 */
export function toStoreId(value: string): StoreId {
  return toSnowflake(value) as StoreId;
}

/** What a request is allowed to touch: its business, that business's stores, and the store it acts on. */
export interface TenantContext {
  readonly businessId: BusinessId;
  readonly storeIds: readonly StoreId[];
  readonly activeStoreId: StoreId;
}
