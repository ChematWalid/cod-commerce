import type { Snowflake, StoreId, TenantScope } from '@cod/shared';
import type { CoreId } from '../core-id';
import type { MediaItem } from '../media-item';
import type { OperationContext } from './operation-context';

/** One page of the media list. */
export interface MediaPage {
  readonly skip: number;
  readonly take: number;
}

/** The items of one page and how many match in all. */
export interface MediaList {
  readonly items: readonly MediaItem[];
  readonly totalItems: number;
}

/**
 * Where the business-wide media library is kept (`catalog_media`, D2113). Reads take the stores the caller may reach
 * (D2132): an item uploaded by another store is found only when that store is in the list.
 */
export interface MediaRepositoryPort {
  /**
   * Stores a new item under the scope's business, in the store `item.storeId` names; the caller passes a store of that
   * business (the active one), which the repository cannot check. Rejects with `InvalidCatalogInputError` when
   * `item.businessId` is another business, and refuses a second item for the same asset (one row per asset).
   */
  insert(ctx: OperationContext, scope: TenantScope, item: MediaItem): Promise<void>;

  /** The item `id` when it belongs to the scope's business and one of `storeIds`, else `undefined`. */
  findById(
    ctx: OperationContext,
    scope: TenantScope,
    storeIds: readonly StoreId[],
    id: Snowflake,
  ): Promise<MediaItem | undefined>;

  /** The items of the scope's business and `storeIds` whose asset is among `assetIds`, in no set order. */
  findByAssetIds(
    ctx: OperationContext,
    scope: TenantScope,
    storeIds: readonly StoreId[],
    assetIds: readonly CoreId[],
  ): Promise<readonly MediaItem[]>;

  /** One page of the items of the scope's business and `storeIds`, newest first, then by id descending. */
  list(ctx: OperationContext, scope: TenantScope, storeIds: readonly StoreId[], page: MediaPage): Promise<MediaList>;

  /**
   * Deletes the item `id` when it belongs to the scope's business and one of `storeIds` (D2132: a member limited to
   * some stores never deletes another store's media); `false` otherwise, and always for an empty list.
   */
  delete(ctx: OperationContext, scope: TenantScope, storeIds: readonly StoreId[], id: Snowflake): Promise<boolean>;
}
