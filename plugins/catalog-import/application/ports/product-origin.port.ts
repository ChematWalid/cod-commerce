import type { OriginView } from '../../domain/export-row';
import type { StoreScope } from '../../domain/store-scope';
import type { OperationContext } from './operation-context';

/** The `catalog_product_origin` rows of a store (D2210), as an export reads them. */
export interface ProductOriginReads {
  /** The origin of each product of `productIds` that has one, by product id; other stores' rows are never read. */
  originsOf(
    ctx: OperationContext,
    scope: StoreScope,
    productIds: readonly string[],
  ): Promise<ReadonlyMap<string, OriginView>>;
}
