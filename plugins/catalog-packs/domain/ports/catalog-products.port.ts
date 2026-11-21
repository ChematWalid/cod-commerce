import type { ComponentProduct } from '../component-product';
import type { PackWrite } from '../pack-write';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

export type { PackWrite } from '../pack-write';

/** The products a pack save writes (its pack product) and reads (the products its component lines name). */
export interface PackSaveLock {
  readonly packProductId: string;
  readonly componentIds: readonly string[];
}

/** The store's products as catalog serves them to packs: reads, and the one write that stores computed values. */
export interface CatalogProductsPort {
  /** The product `productId` of the scope's store, or `undefined` (another store's, deleted, malformed). */
  byId(ctx: OperationContext, scope: StoreScope, productId: string): Promise<ComponentProduct | undefined>;
  /**
   * Holds, until the transaction of `ctx` ends, the pack product for writing and each component for reading (D2242):
   * an edit, status change or delete of a component then commits only after the save, so the recompute it triggers
   * finds the saved pack. Call it inside the save's transaction, after the pack lock, before reading the components
   * the pack is priced from; name only components already read in the scope's store, so no foreign id is locked.
   *
   * @throws {PackNotFoundError} for a malformed pack product id or a scope `ctx` does not run in.
   */
  lockForSave(ctx: OperationContext, scope: StoreScope, lock: PackSaveLock): Promise<void>;
  /**
   * Stores a pack's computed price, weight and variant matrix in its product (D2203, D2227).
   *
   * @throws {PackNotFoundError} when the product is gone, {InvalidPackInputError} when catalog refuses the values.
   */
  writePackValues(ctx: OperationContext, scope: StoreScope, values: PackWrite): Promise<void>;
}
