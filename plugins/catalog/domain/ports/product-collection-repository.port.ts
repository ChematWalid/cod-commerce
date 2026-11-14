import type { CoreId } from '../core-id';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/**
 * Where the links of a store's products to Vendure collections are kept (`catalog_product_collection`): the
 * product's collections until P2.S3 builds collection rules (Task 11 deviation).
 */
export interface ProductCollectionRepositoryPort {
  /**
   * Replaces every collection link of `productId` in the scope's store, kept in the given order; a repeated id is
   * linked once. The ids must already be collections of the store channel (the use case checks them, D2134).
   */
  replaceProductCollections(
    ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
    collectionIds: readonly CoreId[],
  ): Promise<void>;

  /** The collection ids of `productId` in the scope's store, in the order they were given. */
  collectionIdsOf(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<readonly CoreId[]>;

  /** The products of the scope's store linked to `collectionId`, for the list's collection filter. */
  productIdsInCollection(ctx: OperationContext, scope: StoreScope, collectionId: CoreId): Promise<readonly CoreId[]>;

  /** Removes every collection link of `productId` in the scope's store (the product was deleted). */
  deleteProductLinks(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<void>;
}
