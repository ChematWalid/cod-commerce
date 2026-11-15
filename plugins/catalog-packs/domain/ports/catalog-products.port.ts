import type { ComponentProduct } from '../component-product';
import type { PackWrite } from '../pack-write';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

export type { PackWrite } from '../pack-write';

/** The store's products as catalog serves them to packs: reads, and the one write that stores computed values. */
export interface CatalogProductsPort {
  /** The product `productId` of the scope's store, or `undefined` (another store's, deleted, malformed). */
  byId(ctx: OperationContext, scope: StoreScope, productId: string): Promise<ComponentProduct | undefined>;
  /**
   * Stores a pack's computed price, weight and variant matrix in its product (D2203, D2227).
   *
   * @throws {PackNotFoundError} when the product is gone, {InvalidPackInputError} when catalog refuses the values.
   */
  writePackValues(ctx: OperationContext, scope: StoreScope, values: PackWrite): Promise<void>;
}
