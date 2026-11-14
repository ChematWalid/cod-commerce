import { Injectable } from '@nestjs/common';
import { LogicalOperator } from '@vendure/common/lib/generated-types';
import {
  type ListQueryOptions,
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

/** Most products one search pre-query returns: Vendure's admin list cap. The list then pages them (D2123). */
const SEARCH_MATCH_LIMIT = 1000;

/**
 * {@link ProductSearchPort} on Vendure's services (D2123), gate-safe: `ProductService.findAll` with OR over the name
 * and the SKU (core maps `sku` to variant SKUs), plus the products of variants whose `barcode` custom field holds the
 * text. Both run in the active store channel and skip deleted rows.
 */
@Injectable()
export class VendureProductSearch implements ProductSearchPort {
  constructor(
    private readonly products: ProductService,
    private readonly variants: ProductVariantService,
  ) {}

  async matchingProductIds(ctx: OperationContext, text: string): Promise<readonly CoreId[]> {
    const request = toRequestContext(ctx);
    const byText = {
      take: SEARCH_MATCH_LIMIT,
      filter: { name: { contains: text }, sku: { contains: text } },
      filterOperator: LogicalOperator.OR,
    } as ListQueryOptions<Product>;
    const byBarcode = {
      take: SEARCH_MATCH_LIMIT,
      filter: { barcode: { contains: text } },
    } as ListQueryOptions<ProductVariant>;
    const [products, variants] = await Promise.all([
      this.products.findAll(request, byText, []),
      this.variants.findAll(request, byBarcode),
    ]);
    const ids = [...products.items.map((product) => product.id), ...variants.items.map((variant) => variant.productId)];
    return [...new Set(ids.map(String))].map((id) => coreIdOf(id));
  }
}
