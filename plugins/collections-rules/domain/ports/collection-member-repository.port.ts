import type { MemberRow } from '../membership';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** A collection a product joins, at the given position (0 in an automatic collection, D2318). */
export interface MemberPlacement {
  readonly collectionId: string;
  readonly position: number;
}

/** A page of a collection's members. */
export interface MemberPageRequest {
  readonly skip: number;
  readonly take: number;
}

/** The collections one product joins and leaves; a collection it is already in keeps its place. */
export interface ProductMembershipChange {
  readonly in: readonly MemberPlacement[];
  readonly out: readonly string[];
}

/**
 * The store's collection members (`collections_member`, D2300). Every call names the business and the store, and
 * writes run in the transaction of `ctx` after the caller took the store lock (D2334), so a read-then-write plan holds.
 * A member of a collection the store has no definition for, another store's of the same business included, is refused
 * (FK by business, store and collection, D2337) with `CollectionNotFoundError`. That refusal is terminal for the
 * transaction: Postgres has already aborted it, so a caller must let the error end the unit of work and never run
 * another statement on `ctx` after catching it. A writer without the store lock may also be refused by the unique key
 * with `CollectionRowConflictError`, equally terminal. Maps are keyed by canonical ids (`'07'` is keyed `'7'`).
 */
export interface CollectionMemberRepositoryPort {
  /** The members of a collection, by position, then newest product first (D2318). */
  membersOf(ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<readonly MemberRow[]>;
  /** One page of {@link membersOf}, read from the table page by page (an automatic collection has no member cap). */
  membersPage(
    ctx: OperationContext,
    scope: StoreScope,
    collectionId: string,
    page: MemberPageRequest,
  ): Promise<readonly MemberRow[]>;
  /**
   * Makes the collection's members exactly `rows`, writing only the difference (`membershipDiff`). Answers whether
   * anything was inserted, moved or removed.
   */
  replaceMembers(
    ctx: OperationContext,
    scope: StoreScope,
    collectionId: string,
    rows: readonly MemberRow[],
  ): Promise<boolean>;
  /**
   * Adds one product to the `in` collections it is not yet in and removes it from the `out` ones. A collection named in
   * both ends in it: `in` wins, at its `in` position.
   */
  setProductIn(
    ctx: OperationContext,
    scope: StoreScope,
    productId: string,
    change: ProductMembershipChange,
  ): Promise<void>;
  /**
   * The collections of each given product in collection id order, in one query, keyed by the canonical product id;
   * a product of none is absent.
   */
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
