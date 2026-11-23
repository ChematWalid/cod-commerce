import type { SoldOutBehavior } from '@cod/shared';
import type { ListingQuery } from '../listing-query';
import type { ProjectionRow } from '../projection-row';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** A page of listed projection rows and how many the store lists in all under the same filter. */
export interface ProjectionPage {
  readonly items: readonly ProjectionRow[];
  readonly totalItems: number;
}

/** A listing page, optionally narrowed to some products (a collection's members, D3206). */
export interface ProjectionListing extends ListingQuery {
  /** Only these Vendure product ids; an empty list names none. */
  readonly productIds?: readonly string[];
}

/**
 * The `storefront_product` rows of one store (D3205). Every call is confined to the scope's business and store, and
 * writes join the transaction `ctx` carries.
 */
export interface ProjectionRepositoryPort {
  /** Writes the row of `row.productId`, replacing it, and drops a stale row of another product holding its slug. */
  save(ctx: OperationContext, scope: StoreScope, row: ProjectionRow): Promise<void>;

  /** Drops the row of `productId`, if any. */
  remove(ctx: OperationContext, scope: StoreScope, productId: string): Promise<void>;

  /** Drops every row of the store whose product is not in `keptProductIds`, in one statement; answers rows dropped. */
  removeAllExcept(ctx: OperationContext, scope: StoreScope, keptProductIds: readonly string[]): Promise<number>;

  /** Recomputes `listed` of every row of the store under `soldOutBehavior`, in one statement; answers rows touched. */
  relist(ctx: OperationContext, scope: StoreScope, soldOutBehavior: SoldOutBehavior): Promise<number>;

  /** How many rows the store has, listed or not. */
  count(ctx: OperationContext, scope: StoreScope): Promise<number>;

  /** One page of the store's listed rows in `listing.sort` order. */
  listed(ctx: OperationContext, scope: StoreScope, listing: ProjectionListing): Promise<ProjectionPage>;
}
