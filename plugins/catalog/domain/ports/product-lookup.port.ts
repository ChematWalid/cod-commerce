import type { CoreId } from '../core-id';
import type { OperationContext } from './operation-context';
import type { ProductCriteria } from './product-catalog.port';

/** The ids of one list page, in the page's order, and how many products match in all. */
export interface ProductIdPage {
  readonly ids: readonly CoreId[];
  readonly totalItems: number;
}

/**
 * A live variant or product of the store whose SKU may equal a looked-up one: the answer of a loose pre-filter, which
 * the use case compares exactly (D2201).
 */
export interface SkuCandidate {
  readonly productId: CoreId;
  /** The variant holding `sku`, or `null` for the product's own SKU (the `defaultSku` field). */
  readonly variantId: CoreId | null;
  readonly sku: string;
}

/**
 * The reads imports and exports need beside {@link ProductCatalogPort} (D2201, D2218), in the caller's store channel:
 * a product of another channel, or a deleted one, is never among the answers.
 */
export interface ProductLookupPort {
  /** The ids of one page of the store's products matching `criteria`. */
  listIds(ctx: OperationContext, criteria: ProductCriteria): Promise<ProductIdPage>;

  /**
   * The live variants and products of the store whose SKU contains one of `skus`, ignoring case: a superset of the
   * exact matches.
   */
  findBySkus(ctx: OperationContext, skus: readonly string[]): Promise<readonly SkuCandidate[]>;
}
