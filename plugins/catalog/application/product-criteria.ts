import { isSnowflake, type ProductListQuery, type Snowflake } from '@cod/shared';
import { type CoreId, parseCoreId } from '../domain/core-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { ProductCriteria } from '../domain/ports/product-catalog.port';
import type { StoreScope } from '../domain/store-scope';
import type { ProductPorts } from './catalog-ports';

/** The tab, search and filters of the product list, without its page (D2123). */
export type ProductListFilter = Pick<ProductListQuery, 'tab' | 'collectionId' | 'brandId' | 'tagId'> & {
  readonly q?: string;
};

/** What a list filter narrows a page to: every criterion but the page itself. */
export type ProductFilterCriteria = Omit<ProductCriteria, 'skip' | 'take' | 'sort'>;

/** Ids both lists hold; `undefined` stands for "no restriction". */
function intersect(left: readonly CoreId[] | undefined, right: readonly CoreId[]): readonly CoreId[] {
  if (left === undefined) return right;
  const kept = new Set<string>(right);
  return left.filter((id) => kept.has(id));
}

/** The product ids the search, tag and collection allow; `undefined` when none was asked, `null` when one is malformed. */
async function restrictionOf(
  ports: ProductPorts,
  ctx: OperationContext,
  scope: StoreScope,
  filter: ProductListFilter,
): Promise<readonly CoreId[] | undefined | null> {
  let ids: readonly CoreId[] | undefined;
  if (filter.q !== undefined) ids = intersect(ids, await ports.search.matchingProductIds(ctx, filter.q));
  if (filter.tab === 'sold-out') {
    ids = intersect(ids, await ports.soldOut.allSoldOutIds(ctx, scope, scope.storeId));
  }
  if (filter.tagId !== undefined) {
    if (!isSnowflake(filter.tagId)) return null;
    ids = intersect(ids, await ports.tags.productIdsWithTag(ctx, scope, filter.tagId));
  }
  if (filter.collectionId !== undefined) {
    const collectionId = parseCoreId(filter.collectionId);
    if (collectionId === undefined) return null;
    ids = intersect(ids, await ports.collections.productIdsInCollection(ctx, scope, collectionId));
  }
  return ids;
}

const brandOf = (raw: string): Snowflake | null => (isSnowflake(raw) ? raw : null);

/**
 * The criteria of the product list's `filter` in the scope's store (AC4, D2123): the search, the sold-out tab, the tag
 * and the collection each give a set of product ids, combined with the tab and the brand (AND). `null` when a filter
 * id is malformed: the list is then empty, never widened. A filter id of another store or business matches nothing.
 */
export async function criteriaOfFilter(
  ports: ProductPorts,
  ctx: OperationContext,
  scope: StoreScope,
  filter: ProductListFilter,
): Promise<ProductFilterCriteria | null> {
  const productIds = await restrictionOf(ports, ctx, scope, filter);
  if (productIds === null) return null;
  const brandId = filter.brandId === undefined ? undefined : brandOf(filter.brandId);
  if (brandId === null) return null;
  return {
    ...(productIds === undefined ? {} : { productIds }),
    ...(filter.tab === 'draft' ? { status: 'draft' as const } : {}),
    ...(brandId === undefined ? {} : { brandId }),
  };
}
