import type { Snowflake } from '@cod/shared';
import type { StoreScope } from '../store-scope';
import type { CatalogNameEntry } from '../taxonomy';
import type { OperationContext } from './operation-context';

/** Where brands or tags are kept, each confined to `scope.businessId` and `scope.storeId`. */
export interface CatalogNameRepositoryPort {
  /**
   * Stores a new entry.
   *
   * @throws {NameTakenError} when another entry of the store has the same name key; the use case checks
   * {@link findByNameKey} first, the unique index decides a race.
   */
  insert(ctx: OperationContext, scope: StoreScope, entry: CatalogNameEntry): Promise<void>;

  /** The entry `id` of the scope's store, or `undefined`. */
  findById(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<CatalogNameEntry | undefined>;

  /** The entries of the scope's store among `ids`, in no set order; ids of other stores are left out. */
  findByIds(ctx: OperationContext, scope: StoreScope, ids: readonly Snowflake[]): Promise<readonly CatalogNameEntry[]>;

  /** The entry of the scope's store with that name key, or `undefined`. */
  findByNameKey(ctx: OperationContext, scope: StoreScope, nameKey: string): Promise<CatalogNameEntry | undefined>;

  /** How many entries the scope's store keeps. */
  count(ctx: OperationContext, scope: StoreScope): Promise<number>;

  /** Every entry of the scope's store, newest first, then by id descending. */
  list(ctx: OperationContext, scope: StoreScope): Promise<readonly CatalogNameEntry[]>;

  /**
   * Replaces the name, key and update date of `entry.id`; `false` when the store has no such entry.
   *
   * @throws {NameTakenError} when another entry of the store has the new name key.
   */
  update(ctx: OperationContext, scope: StoreScope, entry: CatalogNameEntry): Promise<boolean>;

  /** Deletes the entry `id` (and, for tags, its product links); `false` when the store has no such entry. */
  delete(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean>;
}
