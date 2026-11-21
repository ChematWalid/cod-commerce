import type { StoreId, TenantScope } from '@cod/shared';
import type { CollectionDefinition } from '../collection';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/**
 * A page of a store's definitions; `collectionIds` narrows it to those collections (those the list can show) and
 * `visibleOnly` to the visible ones (the public read, D2316).
 */
export interface DefinitionListRequest {
  readonly skip: number;
  readonly take: number;
  readonly collectionIds?: readonly string[];
  readonly visibleOnly?: boolean;
}

/** One page of definitions and how many match in all. */
export interface DefinitionPage {
  readonly items: readonly CollectionDefinition[];
  readonly totalItems: number;
}

/**
 * The store's collection definitions (`collections_definition`, D2300). Every call names the business and the store:
 * a collection of the business's other store answers like a foreign one. Writes run in the transaction of `ctx`.
 */
export interface CollectionDefinitionRepositoryPort {
  /**
   * Stores a new definition in the scope's store; the definition's own `storeId` is ignored and its collection id is
   * stored canonical. A malformed collection id is refused with `CollectionNotFoundError`; a second definition for a
   * collection of the business with `CollectionRowConflictError` (terminal for the transaction).
   */
  insert(ctx: OperationContext, scope: StoreScope, definition: CollectionDefinition): Promise<void>;
  findByCollectionId(
    ctx: OperationContext,
    scope: StoreScope,
    collectionId: string,
  ): Promise<CollectionDefinition | undefined>;
  /** A page ordered by position, then id (D2318). */
  list(ctx: OperationContext, scope: StoreScope, request: DefinitionListRequest): Promise<DefinitionPage>;
  /** Every automatic definition of the store, the ones a product change is matched against (D2312). */
  listAutomatic(ctx: OperationContext, scope: StoreScope): Promise<readonly CollectionDefinition[]>;
  /** Those of `collectionIds` that are collections of the store, canonical and each once, in first-given order. */
  existing(ctx: OperationContext, scope: StoreScope, collectionIds: readonly string[]): Promise<readonly string[]>;
  /** Saves a changed definition of the store, matched by its collection id; false when the store has no such one. */
  update(ctx: OperationContext, scope: StoreScope, definition: CollectionDefinition): Promise<boolean>;
  /** Deletes the store's definition of a collection with its members (FK cascade, D2337); false when none. */
  delete(ctx: OperationContext, scope: StoreScope, collectionId: string): Promise<boolean>;
  countInStore(ctx: OperationContext, scope: StoreScope): Promise<number>;
  /**
   * The stores of the scope's business that hold an automatic collection, ascending, each once (D2336); with
   * `belowVersion`, only those holding one whose members were built with an older `matchVersion`.
   */
  automaticStores(ctx: OperationContext, scope: TenantScope, belowVersion?: number): Promise<readonly StoreId[]>;
}
