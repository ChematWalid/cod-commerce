import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { type Snowflake, type StoreId, type TenantScope, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { type CoreId, toCoreId } from '../domain/core-id';
import { InvalidCatalogInputError } from '../domain/errors';
import type { MediaItem } from '../domain/media-item';
import type { MediaList, MediaPage, MediaRepositoryPort } from '../domain/ports/media-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { MediaEntity } from './media.entity';
import { requestScope } from './request-scope';

const EMPTY_LIST: MediaList = { items: [], totalItems: 0 };

function toItem(row: MediaEntity): MediaItem {
  return {
    id: toSnowflake(row.id),
    businessId: toBusinessId(row.businessId),
    storeId: toStoreId(row.storeId ?? ''),
    assetId: toCoreId(row.assetId),
    createdAt: row.createdAt,
  };
}

/** The store filter of a read or delete; never called with an empty list, which callers answer themselves. */
const ofStores = (storeIds: readonly StoreId[]) => ({ storeId: In([...storeIds]) });

/**
 * The Postgres adapter of {@link MediaRepositoryPort}: `catalog_media` through `TenantRepository` (ADR 0002). Every
 * read and the delete are narrowed to the stores they are given (D2132).
 */
@Injectable()
export class TypeOrmMediaRepository implements MediaRepositoryPort {
  private readonly rows: TenantRepository<MediaEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(MediaEntity);
  }

  async insert(ctx: OperationContext, scope: TenantScope, item: MediaItem): Promise<void> {
    if (item.businessId !== scope.businessId) throw new InvalidCatalogInputError();
    const { id, storeId, assetId, createdAt } = item;
    await this.rows.insert(requestScope(ctx, scope), { id, storeId, assetId, createdAt });
  }

  async findById(
    ctx: OperationContext,
    scope: TenantScope,
    storeIds: readonly StoreId[],
    id: Snowflake,
  ): Promise<MediaItem | undefined> {
    if (storeIds.length === 0) return undefined;
    const row = await this.rows.findOne(requestScope(ctx, scope), { ...ofStores(storeIds), id });
    return row === null ? undefined : toItem(row);
  }

  async findByAssetIds(
    ctx: OperationContext,
    scope: TenantScope,
    storeIds: readonly StoreId[],
    assetIds: readonly CoreId[],
  ): Promise<readonly MediaItem[]> {
    if (storeIds.length === 0 || assetIds.length === 0) return [];
    const where = { ...ofStores(storeIds), assetId: In([...assetIds]) };
    return (await this.rows.find(requestScope(ctx, scope), { where })).map(toItem);
  }

  async list(
    ctx: OperationContext,
    scope: TenantScope,
    storeIds: readonly StoreId[],
    page: MediaPage,
  ): Promise<MediaList> {
    if (storeIds.length === 0) return EMPTY_LIST;
    const tenant = requestScope(ctx, scope);
    const where = ofStores(storeIds);
    const order = { createdAt: 'DESC', id: 'DESC' } as const;
    const rows = await this.rows.find(tenant, { where, order, skip: page.skip, take: page.take });
    return { items: rows.map(toItem), totalItems: await this.rows.count(tenant, where) };
  }

  async delete(
    ctx: OperationContext,
    scope: TenantScope,
    storeIds: readonly StoreId[],
    id: Snowflake,
  ): Promise<boolean> {
    if (storeIds.length === 0) return false;
    return (await this.rows.delete(requestScope(ctx, scope), { ...ofStores(storeIds), id })) > 0;
  }
}
