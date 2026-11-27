import type { OperationContext } from './operation-context';
import type { StoreScope } from '../store-scope';

/** The catalog's batched product weight reader (D3119), scoped to the store's channel. */
export interface ProductWeightsPort {
  /**
   * The weight in grams of each of the store's live products among `productIds`, `null` when none is set. Unknown,
   * deleted, other-store and malformed ids are left out.
   */
  weightsOf(
    ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<ReadonlyMap<string, number | null>>;
}
