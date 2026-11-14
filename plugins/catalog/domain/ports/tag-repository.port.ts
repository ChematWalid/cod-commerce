import type { Snowflake } from '@cod/shared';
import type { CoreId } from '../core-id';
import type { StoreScope } from '../store-scope';
import type { CatalogNameRepositoryPort } from './catalog-name-repository.port';
import type { OperationContext } from './operation-context';

/** Where a store's tags and the product links to them are kept (`catalog_product_tag`, D2100). */
export interface TagRepositoryPort extends CatalogNameRepositoryPort {
  /** Replaces every tag link of `productId` in the scope's store with `tagIds`, kept in that order. */
  replaceProductTags(
    ctx: OperationContext,
    scope: StoreScope,
    productId: CoreId,
    tagIds: readonly Snowflake[],
  ): Promise<void>;

  /** The tag ids linked to `productId` in the scope's store, in the order they were given. */
  tagIdsOf(ctx: OperationContext, scope: StoreScope, productId: CoreId): Promise<readonly Snowflake[]>;

  /** The products of the scope's store that carry `tagId`, for the list's tag filter. */
  productIdsWithTag(ctx: OperationContext, scope: StoreScope, tagId: Snowflake): Promise<readonly CoreId[]>;
}
