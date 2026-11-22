import type { Snowflake } from '@cod/shared';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** Reads which fee group a store uses by default (tenancy's `StoreSettings.defaultDeliveryFeeGroupId`, D3111). */
export interface StoreDefaultsPort {
  /** The store's default fee group id, or `null` when it has none (or the store is not the scope's). */
  defaultGroupOf(ctx: OperationContext, scope: StoreScope): Promise<Snowflake | null>;
}
