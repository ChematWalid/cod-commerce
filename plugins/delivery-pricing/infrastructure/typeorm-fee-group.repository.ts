import {
  type SnowflakeIdGeneratorPort,
  tenantQuery,
  type TenantRepository,
  type TenantRepositoryFactory,
} from '@cod/plugin-tenancy';
import { type Snowflake, toSnowflake, type WilayaCode } from '@cod/shared';
import { In } from 'typeorm';
import type {
  CommuneRateRow,
  FeeGroupHeader,
  FeeGroupListQuery,
  FeeGroupPage,
  FeeGroupRecord,
  FeeGroupSettings,
  NewFeeGroup,
  WilayaRateRow,
} from '../domain/fee-group';
import type { CommuneRowsChange, FeeGroupRepositoryPort } from '../domain/ports/fee-group-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';
import { FeeCommuneRateEntity } from './fee-commune-rate.entity';
import { communeColumnsOf, communeRowOf, headerOf, wilayaColumnsOf, wilayaRowOf } from './fee-group-rows';
import { FeeGroupEntity } from './fee-group.entity';
import { FeeRateEntity } from './fee-rate.entity';
import { likeLiteralOf } from './like-literal';
import { requestScope } from './request-scope';

const GROUP_ALIAS = 'feeGroup';

/** The store half of a row filter; `TenantRepository` adds the business itself (ADR 0002). */
const inStore = (scope: StoreScope): { storeId: string } => ({ storeId: scope.storeId });

/**
 * The Postgres adapter of {@link FeeGroupRepositoryPort}: `delivery_fee_group`, `delivery_fee_rate` and
 * `delivery_fee_commune_rate` through `TenantRepository` (ADR 0002), every filter naming the store too. Every call
 * joins the transaction `ctx` carries; one query at a time, as a transaction's one connection requires.
 */
export class TypeOrmFeeGroupRepository implements FeeGroupRepositoryPort {
  private readonly groups: TenantRepository<FeeGroupEntity>;
  private readonly rates: TenantRepository<FeeRateEntity>;
  private readonly communes: TenantRepository<FeeCommuneRateEntity>;

  constructor(
    repositories: TenantRepositoryFactory,
    private readonly ids: SnowflakeIdGeneratorPort,
  ) {
    this.groups = repositories.for(FeeGroupEntity);
    this.rates = repositories.for(FeeRateEntity);
    this.communes = repositories.for(FeeCommuneRateEntity);
  }

  async list(ctx: OperationContext, scope: StoreScope, query: FeeGroupListQuery): Promise<FeeGroupPage> {
    const select = tenantQuery(requestScope(ctx, scope), this.groups, GROUP_ALIAS).andWhere(
      `${GROUP_ALIAS}.storeId = :feeGroupStoreId`,
      { feeGroupStoreId: scope.storeId },
    );
    if (query.search !== undefined) {
      select.andWhere(`${GROUP_ALIAS}.name ILIKE :feeGroupSearch`, {
        feeGroupSearch: `%${likeLiteralOf(query.search)}%`,
      });
    }
    const [rows, totalItems] = await select
      .orderBy(`${GROUP_ALIAS}.createdAt`, 'DESC')
      .addOrderBy(`${GROUP_ALIAS}.id`, 'DESC')
      .skip(query.skip)
      .take(query.take)
      .getManyAndCount();
    return { items: rows.map(headerOf), totalItems };
  }

  async find(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<FeeGroupRecord | undefined> {
    const tenant = requestScope(ctx, scope);
    const row = await this.groups.findOne(tenant, { ...inStore(scope), id });
    if (row === null) return undefined;
    const where = { ...inStore(scope), groupId: id };
    const rates = await this.rates.find(tenant, { where, order: { provinceCode: 'ASC' } });
    const communes = await this.communes.find(tenant, { where, order: { codeOns: 'ASC' } });
    return { ...headerOf(row), rates: rates.map(wilayaRowOf), communeRates: communes.map(communeRowOf) };
  }

  async share(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<boolean> {
    const row = await this.byId(ctx, scope, id).setLock('pessimistic_read').getOne();
    return row !== null;
  }

  async lock(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<FeeGroupHeader | undefined> {
    const row = await this.byId(ctx, scope, id).setLock('pessimistic_write').getOne();
    return row === null ? undefined : headerOf(row);
  }

  async platformDefaultId(ctx: OperationContext, scope: StoreScope): Promise<Snowflake | undefined> {
    const row = await this.groups.findOne(requestScope(ctx, scope), { ...inStore(scope), isPlatformDefault: true });
    return row === null ? undefined : toSnowflake(row.id);
  }

  async insert(ctx: OperationContext, scope: StoreScope, group: NewFeeGroup): Promise<Snowflake> {
    const tenant = requestScope(ctx, scope);
    const id = toSnowflake(this.ids.next());
    const now = new Date();
    const { rates, ...header } = group;
    await this.groups.insert(tenant, { id, ...inStore(scope), ...header, createdAt: now, updatedAt: now });
    for (const row of rates) await this.rates.insert(tenant, { ...inStore(scope), ...wilayaColumnsOf(id, row) });
    return id;
  }

  async update(
    ctx: OperationContext,
    scope: StoreScope,
    id: Snowflake,
    change: { readonly settings: FeeGroupSettings; readonly rates: readonly WilayaRateRow[] },
  ): Promise<void> {
    const tenant = requestScope(ctx, scope);
    await this.groups.update(tenant, { ...inStore(scope), id }, { ...change.settings, updatedAt: new Date() });
    for (const row of change.rates) {
      const { provinceCode, ...columns } = row;
      await this.rates.update(tenant, { ...inStore(scope), groupId: id, provinceCode }, columns);
    }
  }

  async delete(ctx: OperationContext, scope: StoreScope, id: Snowflake): Promise<void> {
    // The wilaya and commune rows go with their group through the composite foreign keys (ON DELETE CASCADE).
    await this.groups.delete(requestScope(ctx, scope), { ...inStore(scope), id });
  }

  async communeRows(
    ctx: OperationContext,
    scope: StoreScope,
    groupId: Snowflake,
    provinceCode: WilayaCode,
  ): Promise<readonly CommuneRateRow[]> {
    const rows = await this.communes.find(requestScope(ctx, scope), {
      where: { ...inStore(scope), groupId, provinceCode },
      order: { codeOns: 'ASC' },
    });
    return rows.map(communeRowOf);
  }

  async writeCommuneRows(
    ctx: OperationContext,
    scope: StoreScope,
    groupId: Snowflake,
    change: CommuneRowsChange,
  ): Promise<void> {
    const tenant = requestScope(ctx, scope);
    const touched = [...change.removals, ...change.upserts.map((row) => row.codeOns)];
    if (touched.length > 0) await this.communes.delete(tenant, { ...inStore(scope), groupId, codeOns: In(touched) });
    for (const row of change.upserts) {
      await this.communes.insert(tenant, { ...inStore(scope), ...communeColumnsOf(groupId, row) });
    }
  }

  /** The group `id` of the store, as a tenant query a caller adds its lock to. */
  private byId(ctx: OperationContext, scope: StoreScope, id: Snowflake) {
    return tenantQuery(requestScope(ctx, scope), this.groups, GROUP_ALIAS)
      .andWhere(`${GROUP_ALIAS}.storeId = :feeGroupStoreId`, { feeGroupStoreId: scope.storeId })
      .andWhere(`${GROUP_ALIAS}.id = :feeGroupId`, { feeGroupId: id });
  }
}
