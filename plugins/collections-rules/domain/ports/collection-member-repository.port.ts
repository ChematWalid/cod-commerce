import type { MemberRow } from '../membership';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** A collection a product joins, at the given position (0 in an automatic collection, D2318). */
export interface MemberPlacement {
  readonly collectionId: string;
  readonly position: number;
}

/** The collections one product joins and leaves; a collection it is already in keeps its place. */
export interface ProductMembershipChange {
  readonly in: readonly MemberPlacement[];
  readonly out: readonly string[];
}

/**
 * The store's collection members (`collections_member`, D2300). Every call names the business and the store, and
 * writes run in the transaction of `ctx` after the caller took the store lock (D2334), so a read-then-write plan holds.
 * A member of a collection the business has no definition for is refused (FK, D2337) with `CollectionNotFoundError`.
 */
export interface CollectionMemberRepositoryPort {
  /** The members of a collection, by position, then newest product first (D2318). */
  membersOf(ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<readonly MemberRow[]>;
  /** Makes the collection's members exactly `rows`, writing only the difference (`membershipDiff`). */
  replaceMembers(
    ctx: OperationContext,
    scope: StoreScope,
    collectionId: string,
    rows: readonly MemberRow[],
  ): Promise<void>;
  /** Adds one product to the `in` collections it is not yet in and removes it from the `out` ones. */
  setProductIn(
    ctx: OperationContext,
    scope: StoreScope,
    productId: string,
    change: ProductMembershipChange,
  ): Promise<void>;
  /** The collections of each given product, in one query; a product of no collection is absent. */
  collectionIdsOfProducts(
    ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;
  /** Removes a product from every collection of the store (a deleted product, D2306). */
  deleteProduct(ctx: OperationContext, scope: StoreScope, productId: string): Promise<void>;
  /** How many members each given collection has; a collection without members is absent. */
  countsOf(
    ctx: OperationContext,
    scope: StoreScope,
    collectionIds: readonly string[],
  ): Promise<ReadonlyMap<string, number>>;
  /** The position after the collection's last member, or the first position when it has none. */
  nextPosition(ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<number>;
}
