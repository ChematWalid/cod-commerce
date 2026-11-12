import { type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { type Snowflake, type TenantScope, toBusinessId, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { CommissionConfig } from '../domain/commission-config';
import type { CommissionConfigRepositoryPort } from '../domain/ports/commission-config-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { CommissionConfigEntity } from './commission-config.entity';
import { requestScope } from './request-scope';

function toConfig(row: CommissionConfigEntity): CommissionConfig {
  return {
    id: toSnowflake(row.id),
    businessId: toBusinessId(row.businessId),
    name: row.name,
    nameKey: row.nameKey,
    basis: row.basis,
    valueKind: row.valueKind,
    value: row.value,
    scope: row.scope,
    storeIds: row.storeIds.map(toSnowflake),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The Postgres adapter of {@link CommissionConfigRepositoryPort}, on `TenantRepository` (ADR 0002). */
@Injectable()
export class TypeOrmCommissionConfigRepository implements CommissionConfigRepositoryPort {
  private readonly rows: TenantRepository<CommissionConfigEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(CommissionConfigEntity);
  }

  async insert(ctx: OperationContext, scope: TenantScope, config: CommissionConfig): Promise<void> {
    await this.rows.insert(requestScope(ctx, scope), { ...config, storeIds: [...config.storeIds] });
  }

  async findById(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<CommissionConfig | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { id });
    return row === null ? undefined : toConfig(row);
  }

  async findByNameKey(
    ctx: OperationContext,
    scope: TenantScope,
    nameKey: string,
  ): Promise<CommissionConfig | undefined> {
    const row = await this.rows.findOne(requestScope(ctx, scope), { nameKey });
    return row === null ? undefined : toConfig(row);
  }

  async list(ctx: OperationContext, scope: TenantScope): Promise<readonly CommissionConfig[]> {
    const rows = await this.rows.find(requestScope(ctx, scope), { order: { nameKey: 'ASC', id: 'ASC' } });
    return rows.map(toConfig);
  }
}
