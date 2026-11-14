import { Injectable } from '@nestjs/common';
import { LogicalOperator } from '@vendure/common/lib/generated-types';
import {
  type ListQueryOptions,
  Logger,
  type Product,
  ProductService,
  type ProductVariant,
  ProductVariantService,
} from '@vendure/core';
import type { CoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductSearchPort } from '../domain/ports/product-search.port';
import { toRequestContext } from './request-scope';
import { coreIdOf } from './vendure-product-mapper';

/**
 * Most products, and most variants, one search pre-query returns: Vendure's admin list cap. The list then pages them
 * (D2123). A term matching more is cut here; that is logged (Task 11 deviation, a P3.S2/P10 search item).
 */
export const SEARCH_MATCH_LIMIT = 1000;
const LOG_CONTEXT = 'CatalogSearch';

/**
 * {@link ProductSearchPort} on Vendure's services (D2123), gate-safe: products whose name holds the text through
 * `ProductService.findAll`, plus the products of live variants whose SKU or `barcode` custom field holds it through
 * `ProductVariantService.findAll`. Both run in the active store channel and skip deleted rows: the product list's own
 * `sku` filter joins every variant, soft-deleted ones included, so SKUs are never searched through it.
 */
@Injectable()
export class VendureProductSearch implements ProductSearchPort {
  constructor(
    private readonly products: ProductService,
    private readonly variants: ProductVariantService,
  ) {}

  async matchingProductIds(ctx: OperationContext, text: string): Promise<readonly CoreId[]> {
    const request = toRequestContext(ctx);
    const byName = {
      take: SEARCH_MATCH_LIMIT,
      filter: { name: { contains: text } },
    } as ListQueryOptions<Product>;
    const byCode = {
      take: SEARCH_MATCH_LIMIT,
      filter: { sku: { contains: text }, barcode: { contains: text } },
      filterOperator: LogicalOperator.OR,
    } as ListQueryOptions<ProductVariant>;
    const [products, variants] = await Promise.all([
      this.products.findAll(request, byName, []),
      this.variants.findAll(request, byCode),
    ]);
    warnIfCut('products', products.totalItems);
    warnIfCut('variants', variants.totalItems);
    const ids = [...products.items.map((product) => product.id), ...variants.items.map((variant) => variant.productId)];
    return [...new Set(ids.map(String))].map((id) => coreIdOf(id));
  }
}

/** Makes a cut pre-query visible: the list then under-counts. The search text is never logged. */
function warnIfCut(kind: string, totalItems: number): void {
  if (totalItems <= SEARCH_MATCH_LIMIT) return;
  Logger.warn(
    `Product search matched ${String(totalItems)} ${kind}; only ${String(SEARCH_MATCH_LIMIT)} are listed`,
    LOG_CONTEXT,
  );
}
