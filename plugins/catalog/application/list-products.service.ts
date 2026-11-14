import { isSnowflake, type ProductListQuery, type Snowflake } from '@cod/shared';
import { type CoreId, parseCoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductCriteria } from '../domain/ports/product-catalog.port';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';
import { type ProductView, viewOf } from './product-view';

/** One page of the product list and how many products match in all. */
export interface ProductViewPage {
  readonly items: readonly ProductView[];
  readonly totalItems: number;
}

const EMPTY_PAGE: ProductViewPage = { items: [], totalItems: 0 };

/** Ids both lists hold; `undefined` stands for "no restriction". */
function intersect(left: readonly CoreId[] | undefined, right: readonly CoreId[]): readonly CoreId[] {
  if (left === undefined) return right;
  const kept = new Set<string>(right);
  return left.filter((id) => kept.has(id));
}

/**
 * The admin product list of the caller's active store (AC4, D2123): the search, the sold-out tab, the tag and the
 * collection each give a set of product ids, and the list holds the products in all of them that also match the tab and the brand. A
 * filter id of another store or business, or a malformed one, matches nothing: the list is empty, never widened.
 */
export class ListProductsService {
  constructor(private readonly ports: ProductPorts) {}

  async list(ctx: OperationContext, scope: StoreScope, query: ProductListQuery): Promise<ProductViewPage> {
    const productIds = await this.restriction(ctx, scope, query);
    if (productIds === null) return EMPTY_PAGE;
    const brandId = query.brandId === undefined ? undefined : this.brandOf(query.brandId);
    if (brandId === null) return EMPTY_PAGE;
    const criteria: ProductCriteria = {
      skip: query.skip,
      take: query.take,
      ...(productIds === undefined ? {} : { productIds }),
      ...(query.tab === 'draft' ? { status: 'draft' as const } : {}),
      ...(brandId === undefined ? {} : { brandId }),
    };
    const page = await this.ports.products.list(ctx, criteria);
    const items = await Promise.all(page.items.map((record) => viewOf(this.ports, ctx, scope, record)));
    return { items, totalItems: page.totalItems };
  }

  /** The product ids the search, tag and collection allow; `undefined` when none was asked, `null` when one is malformed. */
  private async restriction(
    ctx: OperationContext,
    scope: StoreScope,
    query: ProductListQuery,
  ): Promise<readonly CoreId[] | undefined | null> {
    let ids: readonly CoreId[] | undefined;
    if ('q' in query) ids = intersect(ids, await this.ports.search.matchingProductIds(ctx, query.q));
    if (query.tab === 'sold-out') {
      ids = intersect(ids, await this.ports.soldOut.allSoldOutIds(ctx, scope, scope.storeId));
    }
    if (query.tagId !== undefined) {
      if (!isSnowflake(query.tagId)) return null;
      ids = intersect(ids, await this.ports.tags.productIdsWithTag(ctx, scope, query.tagId));
    }
    if (query.collectionId !== undefined) {
      const collectionId = parseCoreId(query.collectionId);
      if (collectionId === undefined) return null;
      ids = intersect(ids, await this.ports.collections.productIdsInCollection(ctx, scope, collectionId));
    }
    return ids;
  }

  private brandOf(raw: string): Snowflake | null {
    return isSnowflake(raw) ? raw : null;
  }
}
