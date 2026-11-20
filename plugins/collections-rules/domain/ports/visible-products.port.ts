import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** Which page of a public product list to read. */
export interface ProductPage {
  readonly skip: number;
  readonly take: number;
}

/** An automatic collection's member ids, newest first, and whose they are, so an over-cap warning names it (§3a.8). */
export interface NewestMembers {
  readonly scope: StoreScope;
  readonly collectionId: string;
  readonly productIds: readonly string[];
}

/**
 * The products a public context may show, read through the catalog's visibility rules (D2306, D2310): drafts never,
 * hidden products never in a list, sold-out ones as the store says. `TContext` and `TPage` are the catalog's public
 * list context and product page, opaque to the inner layers. Ids are canonical decimal product ids of the store.
 */
export interface VisibleProductsPort<TContext, TPage> {
  /** The most ids {@link newestAmong} reads; an automatic collection holding more lists its newest ones only. */
  readonly maxNewestIds: number;
  /** One page of the visible products among `productIds`, in the given order (a manual collection). */
  among(ctx: OperationContext, context: TContext, productIds: readonly string[], page: ProductPage): Promise<TPage>;
  /**
   * One page of the visible products among `members.productIds`, newest first (an automatic collection); given more
   * than {@link maxNewestIds} ids it reads the first `maxNewestIds` and logs a warning naming the collection, never an
   * error.
   */
  newestAmong(ctx: OperationContext, context: TContext, members: NewestMembers, page: ProductPage): Promise<TPage>;
}
