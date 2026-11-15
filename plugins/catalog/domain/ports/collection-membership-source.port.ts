import type { CoreId } from '../core-id';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** A collection of the store as the product list's Collection filter offers it (D2324). */
export interface CollectionOption {
  readonly id: CoreId;
  readonly title: string;
}

/**
 * Where the catalog reads and writes which collections hold a store's products (D2309). The default source is the
 * catalog's own `catalog_product_collection` table; collection rules (P2.S3) register theirs on
 * `COLLECTION_MEMBERSHIP_SOURCE_REGISTRAR` on bootstrap, so the catalog never depends on that plugin. A product's own
 * collection ids (its view, its writes, import and export) are the collections it was put in by hand; the list filter
 * sees every member, automatic ones included.
 */
export interface CollectionMembershipSource {
  /**
   * Replaces the manual collections of `productId` in the scope's store with `collectionIds`, in that order; a
   * repeated id is linked once. The ids already passed {@link manualCollectionIdsAmong} (the use case checks them).
   */
  replaceProductCollections(
    ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
    collectionIds: readonly CoreId[],
  ): Promise<void>;

  /** The manual collections of `productId` in the scope's store, in the order they were given. */
  collectionIdsOf(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<readonly CoreId[]>;

  /** Every product of the scope's store in `collectionId`, manual or matched by a rule, for the list filter. */
  productIdsInCollection(ctx: OperationContext, scope: StoreScope, collectionId: CoreId): Promise<readonly CoreId[]>;

  /** Removes `productId` from every collection of the scope's store (the product was deleted). */
  deleteProductLinks(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<void>;

  /**
   * The collections among `collectionIds` a product write may name: those whose products are picked by hand. An
   * automatic collection, or one the source does not know, is left out, and the write answers "not found".
   */
  manualCollectionIdsAmong(
    ctx: OperationContext,
    scope: StoreScope,
    collectionIds: readonly CoreId[],
  ): Promise<readonly CoreId[]>;

  /** The collections of the scope's store with their titles, for the product list's Collection filter. */
  collectionOptionsOf(ctx: OperationContext, scope: StoreScope): Promise<readonly CollectionOption[]>;
}

/** Where another plugin replaces the default {@link CollectionMembershipSource} (D2309). */
export interface CollectionMembershipSourceRegistrar {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(source: CollectionMembershipSource): void;
}
