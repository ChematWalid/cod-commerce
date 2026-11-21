import type { ProductListQuery } from '@cod/shared';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';
import { criteriaOfFilter } from './product-criteria';
import { type ProductView, viewOf } from './product-view';

/** One page of the product list and how many products match in all. */
export interface ProductViewPage {
  readonly items: readonly ProductView[];
  readonly totalItems: number;
}

const EMPTY_PAGE: ProductViewPage = { items: [], totalItems: 0 };

/**
 * The admin product list of the caller's active store (AC4, D2123): the search, the sold-out tab, the tag and the
 * collection each give a set of product ids, and the list holds the products in all of them that also match the tab and the brand. A
 * filter id of another store or business, or a malformed one, matches nothing: the list is empty, never widened.
 */
export class ListProductsService {
  constructor(private readonly ports: ProductPorts) {}

  async list(ctx: OperationContext, scope: StoreScope, query: ProductListQuery): Promise<ProductViewPage> {
    const criteria = await criteriaOfFilter(this.ports, ctx, scope, query);
    if (criteria === null) return EMPTY_PAGE;
    const page = await this.ports.products.list(ctx, { ...criteria, skip: query.skip, take: query.take });
    const items = await Promise.all(page.items.map((record) => viewOf(this.ports, ctx, scope, record)));
    return { items, totalItems: page.totalItems };
  }
}
