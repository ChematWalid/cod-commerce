import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context.port';

/** The variants of a store's product, as the store's channel holds them (D2513): the list filter by product. */
export interface ProductVariantsPort {
  /** The variant ids of `productId` in `scope`'s store; none for a product of another store or an unknown one. */
  variantIdsOf(ctx: OperationContext, scope: StoreScope, productId: string): Promise<readonly string[]>;
}
