import type { CoreId } from '../core-id';
import type { OperationContext } from './operation-context';

/** The admin search of the product list (D2123): products of the store whose name, SKU or barcode holds the text. */
export interface ProductSearchPort {
  /**
   * The products of the active store whose name, product or variant SKU, or variant barcode contains `text`. The
   * list is then narrowed by the tab and the filters, never widened.
   */
  matchingProductIds(ctx: OperationContext, text: string): Promise<readonly CoreId[]>;
}
