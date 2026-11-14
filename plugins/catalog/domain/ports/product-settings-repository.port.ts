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
   * existing one except its id and creation date.
   */
  upsert(ctx: OperationContext, scope: StoreScope, settings: ProductSettings): Promise<void>;

  /** Deletes the settings of `productId` in the scope's store; `false` when there were none. */
  delete(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<boolean>;
}
