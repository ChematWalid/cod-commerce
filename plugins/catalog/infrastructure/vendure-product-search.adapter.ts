import { Injectable } from '@nestjs/common';
import { LogicalOperator } from '@vendure/common/lib/generated-types';
import {
  ConfigService,
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

/** One page of a Vendure list. */
interface ListPage<T> {
  readonly items: readonly T[];
  readonly totalItems: number;
}

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
 *
 * A REST call reaches Vendure as the shop API, whose list cap (100) is below {@link SEARCH_MATCH_LIMIT}: asking past
 * it fails the whole call, so the pre-queries are read in pages no larger than the cap of the call's API.
 */
@Injectable()
export class VendureProductSearch implements ProductSearchPort {
  constructor(
    private readonly products: ProductService,
    private readonly variants: ProductVariantService,
    private readonly config: ConfigService,
  ) {}

  async matchingProductIds(ctx: OperationContext, text: string): Promise<readonly CoreId[]> {
    const request = toRequestContext(ctx);
    const pageSize = this.pageSizeFor(request.apiType);
    const byName = { filter: { name: { contains: text } } } as ListQueryOptions<Product>;
    const byCode = {
      filter: { sku: { contains: text }, barcode: { contains: text } },
      filterOperator: LogicalOperator.OR,
    } as ListQueryOptions<ProductVariant>;
    const [products, variants] = await Promise.all([
      readPaged(pageSize, (page) => this.products.findAll(request, { ...byName, ...page }, [])),
      readPaged(pageSize, (page) => this.variants.findAll(request, { ...byCode, ...page })),
    ]);
    warnIfCut('products', products.totalItems);
    warnIfCut('variants', variants.totalItems);
    const ids = [...products.items.map((product) => product.id), ...variants.items.map((variant) => variant.productId)];
    return [...new Set(ids.map(String))].map((id) => coreIdOf(id));
  }

  private pageSizeFor(apiType: string): number {
    const { adminListQueryLimit, shopListQueryLimit } = this.config.apiOptions;
    return Math.min(SEARCH_MATCH_LIMIT, apiType === 'admin' ? adminListQueryLimit : shopListQueryLimit);
  }
}

/** Up to {@link SEARCH_MATCH_LIMIT} rows of a list, read `pageSize` at a time; `totalItems` is the list's own. */
async function readPaged<T>(
  pageSize: number,
  fetchPage: (page: { readonly skip: number; readonly take: number }) => Promise<ListPage<T>>,
): Promise<ListPage<T>> {
  const items: T[] = [];
  let totalItems = 0;
  do {
    const take = Math.min(pageSize, SEARCH_MATCH_LIMIT - items.length);
    const page = await fetchPage({ skip: items.length, take });
    items.push(...page.items);
    totalItems = page.totalItems;
    if (page.items.length < take) break;
  } while (items.length < Math.min(totalItems, SEARCH_MATCH_LIMIT));
  return { items, totalItems };
}

/** Makes a cut pre-query visible: the list then under-counts. The search text is never logged. */
function warnIfCut(kind: string, totalItems: number): void {
  if (totalItems <= SEARCH_MATCH_LIMIT) return;
  Logger.warn(
    `Product search matched ${String(totalItems)} ${kind}; only ${String(SEARCH_MATCH_LIMIT)} are listed`,
    LOG_CONTEXT,
  );
}
