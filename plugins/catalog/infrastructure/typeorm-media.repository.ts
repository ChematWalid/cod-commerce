import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { type Snowflake, type TenantScope, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { type CoreId, toCoreId } from '../domain/core-id';
import { ConcurrentUpdateError, InvalidCatalogInputError } from '../domain/errors';
import type { MediaItem } from '../domain/media-item';
import type { MediaList, MediaPage, MediaReach, MediaRepositoryPort } from '../domain/ports/media-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { MediaEntity } from './media.entity';
import { requestScope } from './request-scope';
import { onUniqueViolation } from './unique-violation';

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

/** The store filter of a read or delete: none for every store of the business. */
const ofStores = (reach: MediaReach) => (reach === 'all' ? {} : { storeId: In([...reach]) });

/** A reach that names no store finds nothing, so the query is not run. */
const reachesNothing = (reach: MediaReach): boolean => reach !== 'all' && reach.length === 0;

/**
 * The Postgres adapter of {@link MediaRepositoryPort}: `catalog_media` through `TenantRepository` (ADR 0002). Every
 * read and the delete are narrowed to the stores the caller reaches (D2132).
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
    // The unique (businessId, assetId) index refuses a second row of one asset; its driver error names the constraint.
    const inserting = this.rows.insert(requestScope(ctx, scope), { id, storeId, assetId, createdAt });
    await onUniqueViolation(inserting, () => new ConcurrentUpdateError());
  }

  async findById(
    ctx: OperationContext,
    scope: TenantScope,
    reach: MediaReach,
    id: Snowflake,
  ): Promise<MediaItem | undefined> {
    if (reachesNothing(reach)) return undefined;
    const row = await this.rows.findOne(requestScope(ctx, scope), { ...ofStores(reach), id });
    return row === null ? undefined : toItem(row);
  }

  async findByAssetIds(
    ctx: OperationContext,
    scope: TenantScope,
    reach: MediaReach,
    assetIds: readonly CoreId[],
  ): Promise<readonly MediaItem[]> {
    if (reachesNothing(reach) || assetIds.length === 0) return [];
    const where = { ...ofStores(reach), assetId: In([...assetIds]) };
    return (await this.rows.find(requestScope(ctx, scope), { where })).map(toItem);
  }

  async list(ctx: OperationContext, scope: TenantScope, reach: MediaReach, page: MediaPage): Promise<MediaList> {
    if (reachesNothing(reach)) return EMPTY_LIST;
    const tenant = requestScope(ctx, scope);
    const where = ofStores(reach);
    const order = { createdAt: 'DESC', id: 'DESC' } as const;
    const rows = await this.rows.find(tenant, { where, order, skip: page.skip, take: page.take });
    return { items: rows.map(toItem), totalItems: await this.rows.count(tenant, where) };
  }

  async delete(ctx: OperationContext, scope: TenantScope, reach: MediaReach, id: Snowflake): Promise<boolean> {
    if (reachesNothing(reach)) return false;
    return (await this.rows.delete(requestScope(ctx, scope), { ...ofStores(reach), id })) > 0;
  }
}
