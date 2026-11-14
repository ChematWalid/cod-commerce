import type { CoreId } from '../core-id';
import type { ProductSettings } from '../product-settings';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** Where the settings of a store's products are kept, one row per product (`catalog_product_settings`). */
export interface ProductSettingsRepositoryPort {
  /** The settings of `productId` in the scope's store, or `undefined` when none were saved. */
  findByProduct(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<ProductSettings | undefined>;

  /**
   * Saves `settings` for `settings.productId` in the scope's store: inserts the row, or replaces every field of the
   * existing one except its id and creation date. When a parallel first save of the same product inserts its row
   * first, the call rejects with `ConcurrentUpdateError` (the caller may retry) and changes nothing.
   */
  upsert(ctx: OperationContext, scope: StoreScope, settings: ProductSettings): Promise<void>;

  /**
   * The products of the scope's store whose manual sold-out flag is on (D2107), in id order; only those among
   * `productIds` when given.
   */
  soldOutProductIds(
    ctx: OperationContext,
    scope: StoreScope,
    productIds?: readonly CoreId[],
  ): Promise<readonly CoreId[]>;

  /** Deletes the settings of `productId` in the scope's store; `false` when there were none. */
  delete(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<boolean>;
}
