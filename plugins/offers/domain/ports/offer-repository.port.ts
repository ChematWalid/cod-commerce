import type { OfferStatus, Snowflake } from '@cod/shared';
import type { OfferRecord, StoredCode } from '../offer-record';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/** Which offers of the store a list returns; no status means every one. */
export interface OfferListFilter {
  readonly status?: OfferStatus;
}

/**
 * Where a store's offers and their targets are kept (D2405), each call confined to `scope.businessId` and
 * `scope.storeId`: an offer of the business's other store answers like a foreign one.
 */
export interface OfferRepositoryPort {
  /**
   * Stores a new offer with its targets, atomically.
   *
   * @throws {NoActiveStoreError} when the scope names no store.
   */
  create(ctx: OperationContext, scope: StoreScope, offer: OfferRecord): Promise<void>;

  /**
   * Replaces the offer's fields and targets (not its creation instant or usage count) when its stored version is still
   * `expectedVersion`, the one the edit was read at (optimistic lock, D2440); `false` when the store has no such offer
   * or another write has moved it past that version.
   */
  update(ctx: OperationContext, scope: StoreScope, offer: OfferRecord, expectedVersion: number): Promise<boolean>;

  /** The offer `id` of the scope's store, with its targets in their order, or `undefined`. */
  findById(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<OfferRecord | undefined>;

  /** The store's offers matching `filter`, newest first, then by id descending. */
  list(ctx: OperationContext, scope: StoreScope, filter: OfferListFilter): Promise<readonly OfferRecord[]>;

  /** Deletes the offer with its targets and codes; `false` when the store has no such offer. */
  delete(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean>;

  /** The store's `active` offers with their targets: the only ones a quote prices (D2419). */
  activeOf(ctx: OperationContext, scope: StoreScope): Promise<readonly OfferRecord[]>;
}

/** Where a store's discount codes are kept (D2406), each call confined to the scope's business and store. */
export interface OfferCodeRepositoryPort {
  /**
   * Stores codes already normalised, all or none.
   *
   * @throws {NoActiveStoreError} when the scope names no store.
   * @throws {OfferNotFoundError} when a code's offer is not an offer of the scope's store.
   * @throws {CodeTakenError} when the store already has one of the codes, or the call repeats one.
   */
  add(ctx: OperationContext, scope: StoreScope, codes: readonly StoredCode[]): Promise<void>;

  /** Deletes the offer's code `code` (normalised first); `false` when the offer has no such code. */
  remove(ctx: OperationContext, scope: StoreScope, offerId: Snowflake, code: string): Promise<boolean>;

  /** The codes of the offer, oldest first. */
  listOf(ctx: OperationContext, scope: StoreScope, offerId: Snowflake): Promise<readonly StoredCode[]>;

  /** The store's codes among `codes`, each normalised before the lookup, in no set order. */
  findByCodes(ctx: OperationContext, scope: StoreScope, codes: readonly string[]): Promise<readonly StoredCode[]>;
}
