import { type BusinessId, type Snowflake, type StoreId, toSnowflake, toStoreId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { Asset, TransactionalConnection } from '@vendure/core';
import type { ObjectLiteral, ObjectType, Repository, SelectQueryBuilder } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type { Business } from '../domain/business';
import type { HostStoreLookupPort, HostStoreRow } from '../domain/ports/host-store-lookup.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { BusinessOwnerPatch, BusinessPatch, PlatformStorePort } from '../domain/ports/platform-store.port';
import type { Store, StoreAccess } from '../domain/store';
import { BusinessOrderSequenceEntity } from './business-order-sequence.entity';
import { BusinessEntity } from './business.entity';
import { CustomDomainEntity } from './custom-domain.entity';
import { toRequestContext } from './operation-context.adapter';
import { StoreEntity } from './store.entity';
import { translateSubdomainConflict } from './subdomain-conflict';

function toBusiness(row: BusinessEntity): Business {
  return {
    id: toSnowflake(row.id),
    name: row.name,
    logoAssetId: row.logoAssetId,
    onboardingState: row.onboardingState,
    ownerAdministratorId: row.ownerAdministratorId,
    sellerId: row.sellerId,
    ownerRoleId: row.ownerRoleId,
    planId: row.planId === null ? null : toSnowflake(row.planId),
    status: row.status,
    createdAt: row.createdAt,
  };
}

/**
 * Unscoped reads and writes of `business` and `store` (A7). Provisioning runs before any tenant context exists,
 * so these cannot go through `TenantRepository`; this file alone is on the lint allow-list for that reason.
 */
@Injectable()
export class PlatformStoreLookup implements PlatformStorePort, HostStoreLookupPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async saveBusiness(ctx: OperationContext, business: Business): Promise<void> {
    await this.repository(ctx, BusinessEntity).insert({ ...business } as QueryDeepPartialEntity<BusinessEntity>);
  }

  async findBusiness(ctx: OperationContext, id: Snowflake): Promise<Business | undefined> {
    const row = await this.repository(ctx, BusinessEntity).findOne({ where: { id } });
    return row === null ? undefined : toBusiness(row);
  }

  async updateBusinessOwner(ctx: OperationContext, id: Snowflake, patch: BusinessOwnerPatch): Promise<void> {
    await this.repository(ctx, BusinessEntity).update({ id }, patch);
  }

  async updateBusiness(ctx: OperationContext, id: Snowflake, patch: BusinessPatch): Promise<void> {
    await this.repository(ctx, BusinessEntity).update({ id }, patch);
  }

  async lockBusiness(ctx: OperationContext, id: Snowflake): Promise<void> {
    await this.repository(ctx, BusinessEntity).findOne({
      where: { id },
      select: { id: true },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async createOrderSequence(ctx: OperationContext, businessId: Snowflake): Promise<void> {
    await this.repository(ctx, BusinessOrderSequenceEntity).insert({ businessId });
  }

  async saveStore(ctx: OperationContext, store: Store): Promise<void> {
    await translateSubdomainConflict(this.repository(ctx, StoreEntity).insert({ ...store }));
  }

  async isSubdomainTaken(ctx: OperationContext, subdomain: string): Promise<boolean> {
    return this.repository(ctx, StoreEntity).existsBy({ subdomain });
  }

  /** Every store of the business, whatever its status: the resolver decides what counts. */
  async findStoreAccess(ctx: OperationContext, businessId: BusinessId): Promise<readonly StoreAccess[]> {
    const rows = await this.repository(ctx, StoreEntity).find({
      where: { businessId },
      select: { id: true, channelId: true, status: true },
    });
    return rows.map((row) => ({ id: toStoreId(row.id), channelId: row.channelId, status: row.status }));
  }

  async findBySubdomain(subdomain: string): Promise<HostStoreRow | null> {
    const row = await this.servedStores()
      .andWhere('store.subdomain = :subdomain', { subdomain })
      .getRawOne<HostStoreRow>();
    return row ?? null;
  }

  /** A domain that is not verified yet serves nothing: anyone could have claimed it. */
  async findByCustomDomain(host: string): Promise<HostStoreRow | null> {
    const row = await this.servedStores()
      .innerJoin(CustomDomainEntity, 'domain', 'domain.storeId = store.id')
      .andWhere('domain.host = :host AND domain.verifiedAt IS NOT NULL', { host })
      .getRawOne<HostStoreRow>();
    return row ?? null;
  }

  async findById(id: Snowflake): Promise<HostStoreRow | null> {
    const row = await this.servedStores().andWhere('store.id = :id', { id }).getRawOne<HostStoreRow>();
    return row ?? null;
  }

  async findCustomDomains(storeId: StoreId): Promise<readonly string[]> {
    const rows = await this.connection.rawConnection
      .getRepository(CustomDomainEntity)
      .find({ where: { storeId }, select: { host: true } });
    return rows.map((row) => row.host);
  }

  /** The columns of {@link HostStoreRow}, for stores that serve buyers: active, of an active business. */
  private servedStores(): SelectQueryBuilder<StoreEntity> {
    return this.connection.rawConnection
      .getRepository(StoreEntity)
      .createQueryBuilder('store')
      .innerJoin(BusinessEntity, 'business', 'business.id = store.businessId')
      .leftJoin(Asset, 'asset', 'asset.id = store.logoAssetId')
      .select('store.id', 'storeId')
      .addSelect('store.businessId', 'businessId')
      .addSelect('store.language', 'language')
      .addSelect('store.name', 'name')
      .addSelect('store.subdomain', 'subdomain')
      .addSelect('asset.preview', 'logo')
      .where('store.status = :storeStatus', { storeStatus: 'active' })
      .andWhere('business.status = :businessStatus', { businessStatus: 'active' });
  }

  private repository<T extends ObjectLiteral>(ctx: OperationContext, entity: ObjectType<T>): Repository<T> {
    return this.connection.getRepository(toRequestContext(ctx), entity);
  }
}
