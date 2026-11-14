import type { StoreId, TenantScope } from '@cod/shared';
import type { CoreId } from '../core-id';
import type { OperationContext } from './operation-context';

/**
 * Which products of a store are sold out (D2107). The default adapter reads the merchant's manual "sold out" flag;
 * stock levels (P6.S1) replace it by registering their own source on `SOLD_OUT_SOURCE_REGISTRAR` on bootstrap, so the
 * catalog never depends on the stock plugin. Vendure stock is never read: store channels have no stock location, so
 * it would call every product sold out.
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

/** Where another plugin replaces the default {@link SoldOutSource} (injected as `SOLD_OUT_SOURCE_REGISTRAR`). */
export interface SoldOutSourceRegistrar {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(source: SoldOutSource): void;
}
