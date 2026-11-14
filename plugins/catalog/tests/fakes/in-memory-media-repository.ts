import type { Snowflake, StoreId, TenantScope } from '@cod/shared';
import type { CoreId } from '../../domain/core-id';
import { InvalidCatalogInputError } from '../../domain/errors';
import type { MediaItem } from '../../domain/media-item';
import type { MediaList, MediaPage, MediaRepositoryPort } from '../../domain/ports/media-repository.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import { newestFirst } from './store-rows';

/** The media library in memory, read through the caller's stores (D2132); it passes the media contract. */
export class InMemoryMediaRepository implements MediaRepositoryPort {
  readonly rows: MediaItem[] = [];

  private reachable(scope: TenantScope, storeIds: readonly StoreId[]): MediaItem[] {
    return this.rows.filter((row) => row.businessId === scope.businessId && storeIds.includes(row.storeId));
  }

  insert(_ctx: OperationContext, scope: TenantScope, item: MediaItem): Promise<void> {
    if (item.businessId !== scope.businessId) return Promise.reject(new InvalidCatalogInputError());
    const sameAsset = (row: MediaItem) => row.businessId === scope.businessId && row.assetId === item.assetId;
    // Postgres' unique (businessId, assetId) index refuses the row the same way.
    if (this.rows.some(sameAsset)) return Promise.reject(new Error('Duplicate media item for one asset'));
    this.rows.push(item);
    return Promise.resolve();
  }

  findById(
    _ctx: OperationContext,
    scope: TenantScope,
    storeIds: readonly StoreId[],
    id: Snowflake,
  ): Promise<MediaItem | undefined> {
    return Promise.resolve(this.reachable(scope, storeIds).find((row) => row.id === id));
  }

  findByAssetIds(
    _ctx: OperationContext,
    scope: TenantScope,
    storeIds: readonly StoreId[],
    assetIds: readonly CoreId[],
  ): Promise<readonly MediaItem[]> {
    return Promise.resolve(this.reachable(scope, storeIds).filter((row) => assetIds.includes(row.assetId)));
  }

  list(_ctx: OperationContext, scope: TenantScope, storeIds: readonly StoreId[], page: MediaPage): Promise<MediaList> {
    const matches = newestFirst(this.reachable(scope, storeIds));
    return Promise.resolve({ items: matches.slice(page.skip, page.skip + page.take), totalItems: matches.length });
  }

  delete(_ctx: OperationContext, scope: TenantScope, storeIds: readonly StoreId[], id: Snowflake): Promise<boolean> {
    const item = this.reachable(scope, storeIds).find((row) => row.id === id);
    if (item === undefined) return Promise.resolve(false);
    this.rows.splice(this.rows.indexOf(item), 1);
    return Promise.resolve(true);
  }
}
