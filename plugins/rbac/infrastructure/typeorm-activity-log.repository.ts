import type { OperationContext } from '../domain/ports/operation-context';
import { RequestTenantScope, type TenantRepository, TenantRepositoryFactory, tenantQuery } from '@cod/plugin-tenancy';
import { type Snowflake, type TenantScope, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type { ActivityEntry, ActivityQuery, ActivityRecord } from '../domain/activity';
import type { ActivityLogPort } from '../domain/ports/activity-log.port';
import { ActivityLogEntity } from './activity-log.entity';
import { toRequestContext } from './request-context';

const ALIAS = 'activity';

function toRecord(row: ActivityLogEntity): ActivityRecord {
  return {
    id: toSnowflake(row.id),
    storeId: row.storeId,
    actorAdministratorId: row.actorAdministratorId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    diff: row.diff,
    ip: row.ip,
    createdAt: row.createdAt,
  };
}

/** The columns a filter narrows on, each with the parameter that carries its value. */
const EQUALS_FILTERS = [
  ['actorAdministratorId', 'actorAdministratorId'],
  ['action', 'action'],
  ['entityType', 'entityType'],
  ['entityId', 'entityId'],
] as const;

/**
 * The Postgres adapter of {@link ActivityLogPort}, on `TenantRepository` (ADR 0002). Reads page by `id`
 * descending, which the `(businessId, …, id)` indexes scan backward (D65).
 */
@Injectable()
export class TypeOrmActivityLogRepository implements ActivityLogPort {
  private readonly rows: TenantRepository<ActivityLogEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(ActivityLogEntity);
  }

  async append(ctx: OperationContext, entry: ActivityEntry): Promise<void> {
    const scope = new RequestTenantScope(toRequestContext(ctx), entry.scope.businessId);
    await this.rows.insert(scope, {
      id: entry.id,
      storeId: entry.storeId ?? null,
      actorAdministratorId: entry.actorAdministratorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      diff: entry.diff as QueryDeepPartialEntity<ActivityLogEntity>['diff'],
      ip: entry.ip,
      userAgent: entry.userAgent,
      createdAt: entry.createdAt,
    });
  }

  async list(ctx: OperationContext, scope: TenantScope, query: ActivityQuery): Promise<readonly ActivityRecord[]> {
    const rows = await this.listQuery(ctx, scope, query).getMany();
    return rows.map(toRecord);
  }

  /** The select behind {@link list}, so a test can ask Postgres for its plan. */
  listQuery(ctx: OperationContext, scope: TenantScope, query: ActivityQuery): SelectQueryBuilder<ActivityLogEntity> {
    const requestScope = new RequestTenantScope(toRequestContext(ctx), scope.businessId);
    const select = tenantQuery(requestScope, this.rows, ALIAS);
    this.limitToVisibleStores(select, query.visibleStoreIds);
    if (query.before !== undefined) select.andWhere(`${ALIAS}.id < :before`, { before: query.before });
    for (const [column, parameter] of EQUALS_FILTERS) {
      const value: string | number | undefined = query[column];
      if (value !== undefined) select.andWhere(`${ALIAS}.${column} = :${parameter}`, { [parameter]: value });
    }
    return select.orderBy(`${ALIAS}.id`, 'DESC').limit(query.limit);
  }

  private limitToVisibleStores(select: SelectQueryBuilder<ActivityLogEntity>, stores: readonly Snowflake[]): void {
    if (stores.length === 0) {
      select.andWhere(`${ALIAS}.storeId IS NULL`);
      return;
    }
    select.andWhere(`(${ALIAS}.storeId IS NULL OR ${ALIAS}.storeId IN (:...visibleStores))`, {
      visibleStores: stores,
    });
  }
}
