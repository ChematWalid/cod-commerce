import type { OperationContext } from './operation-context';
import type { StoreScope } from '../store-scope';

/**
 * The weight in grams of each product read, `null` when none is set; or `'unreadable'` when the store's products
 * cannot be read in this context (a context off the store's channel), which the quote answers unresolved (#293).
 */
export type ProductWeights = ReadonlyMap<string, number | null> | 'unreadable';

/** The catalog's batched product weight reader (D3119), scoped to the store's channel. */
export interface ProductWeightsPort {
  /**
   * The weight in grams of each of the store's live products among `productIds`, `null` when none is set. Unknown,
   * deleted, other-store and malformed ids are left out.
   */
  weightsOf(ctx: OperationContext, scope: StoreScope, productIds: readonly string[]): Promise<ProductWeights>;
}
