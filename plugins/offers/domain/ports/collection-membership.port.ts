import type { CoreId } from '../core-id';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/**
 * Which of the store's collections each product belongs to, manual and automatic (D2423), and which collections the
 * store has (D2342). P2.S3 registers its source on `COLLECTION_MEMBERSHIP_REGISTRAR`; until then no product is in any
 * collection, so a collection target matches nothing. The offers never read catalog tables.
 */
export interface CollectionMembership {
  /** The collection ids of each product among `productIds`, by product id; a missing product is in none. */
  collectionsOf(
    ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly CoreId[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;

  /**
   * The ids among `collectionIds` that are live collections of `scope`'s store, so an offer target never names another
   * store's or business's collection (D2342). The default source, used while nothing is registered, answers every id
   * unchanged: collection targets then stay unchecked, as before P2.S3.
   */
  existingCollectionIds(
    ctx: OperationContext,
    scope: StoreScope,
    collectionIds: readonly string[],
  ): Promise<readonly string[]>;
}

/** Where P2.S3 registers its {@link CollectionMembership} (injected as `COLLECTION_MEMBERSHIP_REGISTRAR`). */
export interface CollectionMembershipRegistrar {
  /** @throws {Error} when a source is already registered: two sources would silently disagree. */
  register(source: CollectionMembership): void;
}
