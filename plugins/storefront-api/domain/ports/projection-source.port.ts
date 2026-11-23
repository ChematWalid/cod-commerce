import type { ProjectedProduct } from '../projection-row';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** A product of the store as the projection reads it, with whether it is sold out. */
export interface ProjectionSource {
  readonly product: ProjectedProduct;
  readonly soldOut: boolean;
}

/** One keyset page of a store's product ids and the cursor of the next, `null` after the last. */
export interface ProductIdPage {
  readonly ids: readonly string[];
  readonly next: string | null;
}

/**
 * The catalog as the projection reads it, through a storefront context of the store (D3201): the public landing-page
 * view, the widest a buyer may get, so visibility rules stay the catalog's (ADR 0017).
 */
export interface ProjectionSourcePort {
  /** The product `productId` of the context's store, or `undefined` when it is unknown, deleted or a draft. */
  productOf(ctx: OperationContext, productId: string): Promise<ProjectionSource | undefined>;

  /** One page of the store's live product ids, newest first, after `after` (`null` for the first page). */
  productIds(ctx: OperationContext, scope: StoreScope, after: string | null, take: number): Promise<ProductIdPage>;
}
