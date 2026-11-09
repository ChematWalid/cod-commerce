import { type BusinessId, type StoreId, toSnowflake, toStoreId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreWrite, TenantStoresPort } from '../domain/ports/tenant-stores.port';
import type { Store } from '../domain/store';
import { toRequestContext } from './operation-context.adapter';
import { RequestTenantScope } from './request-tenant-scope';
import { StoreEntity } from './store.entity';
import { translateSubdomainConflict } from './subdomain-conflict';
import { type TenantRepository, TenantRepositoryFactory } from './tenant-repository';

function toStore(row: StoreEntity): Store {
  const id = toStoreId(row.id);
  return {
    id,
    businessId: toSnowflake(row.businessId),
    storeId: id,
    channelId: row.channelId,
    sellerId: row.sellerId,
    name: row.name,
    description: row.description,
    logoAssetId: row.logoAssetId,
    language: row.language,
    subdomain: row.subdomain,
    defaultDeliveryFeeGroupId:
      row.defaultDeliveryFeeGroupId === null ? null : toSnowflake(row.defaultDeliveryFeeGroupId),
    defaultCarrierId: row.defaultCarrierId === null ? null : toSnowflake(row.defaultCarrierId),
    showAddressField: row.showAddressField,
    soldOutBehavior: row.soldOutBehavior,
    status: row.status,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** {@link TenantStoresPort} on `TenantRepository`, so every statement carries the business filter (ADR 0002). */
@Injectable()
export class TenantStoresAdapter implements TenantStoresPort {
  private readonly stores: TenantRepository<StoreEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.stores = repositories.for(StoreEntity);
  }

  async list(ctx: OperationContext, businessId: BusinessId): Promise<readonly Store[]> {
    const rows = await this.stores.find(this.scope(ctx, businessId), { order: { createdAt: 'ASC' } });
    return rows.map(toStore);
  }

  async find(ctx: OperationContext, businessId: BusinessId, id: StoreId): Promise<Store | undefined> {
    const row = await this.stores.findOne(this.scope(ctx, businessId), { id });
    return row === null ? undefined : toStore(row);
  }

  countActive(ctx: OperationContext, businessId: BusinessId): Promise<number> {
    return this.stores.count(this.scope(ctx, businessId), { status: 'active' });
  }

  async update(ctx: OperationContext, businessId: BusinessId, id: StoreId, write: StoreWrite): Promise<void> {
    await translateSubdomainConflict(this.stores.update(this.scope(ctx, businessId), { id }, write));
  }

  private scope(ctx: OperationContext, businessId: BusinessId): RequestTenantScope {
    return new RequestTenantScope(toRequestContext(ctx), businessId);
  }
}
