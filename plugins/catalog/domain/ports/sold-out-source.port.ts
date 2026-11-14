import type { StoreId, TenantScope } from '@cod/shared';
import type { CoreId } from '../core-id';
import type { OperationContext } from './operation-context';

/**
 * Which products of a store are sold out (D2107). The default adapter reads the merchant's manual "sold out" flag;
 * stock levels (P6.S1) replace it with one provider line on `SOLD_OUT_SOURCE`. Vendure stock is never read: store
 * channels have no stock location, so it would call every product sold out.
 */
export interface SoldOutSource {
  /** The products among `productIds` that are sold out in `storeId` of `scope`'s business. */
  soldOutIds(
    ctx: OperationContext,
    scope: TenantScope,
    storeId: StoreId,
    productIds: readonly CoreId[],
  ): Promise<ReadonlySet<string>>;

  /** Every sold-out product of `storeId` of `scope`'s business, in id order. */
  allSoldOutIds(ctx: OperationContext, scope: TenantScope, storeId: StoreId): Promise<readonly CoreId[]>;
}
