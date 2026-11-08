import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { FindManyOptions, FindOptionsWhere, ObjectType, Repository, SelectQueryBuilder } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TenantQueryWidenedError } from '../domain/errors';
import { requestContextOf } from './request-tenant-scope';
import type { TenantEntity } from './tenant.entity';

type Where<T> = FindOptionsWhere<T>;

const inScope = <T>(scope: TenantScope, where: Where<T> = {}): Where<T> => ({ ...where, businessId: scope.businessId });

/** An empty array means "no filter" to TypeORM, so it must not skip the business condition. */
function scopedWhere<T>(scope: TenantScope, where?: Where<T> | Where<T>[]): Where<T> | Where<T>[] {
  if (!Array.isArray(where)) return inScope(scope, where);
  return where.length === 0 ? inScope(scope) : where.map((alternative) => inScope(scope, alternative));
}

/** Makes `where` keep the business filter, and `orWhere` an error: a builder must stay inside its tenant. */
function lockedToTenant<T extends TenantEntity>(query: SelectQueryBuilder<T>): SelectQueryBuilder<T> {
  query.where = query.andWhere.bind(query);
  query.orWhere = () => {
    throw new TenantQueryWidenedError();
  };
  return query;
}

/** The only way to tenant tables (ADR 0002): every call forces the scope's `businessId`, ignoring any in the input. */
export class TenantRepository<T extends TenantEntity> {
  constructor(
    private readonly connection: TransactionalConnection,
    private readonly entity: ObjectType<T>,
  ) {}

  findOne(scope: TenantScope, where: Where<T>): Promise<T | null> {
    return this.repository(scope).findOne({ where: inScope(scope, where) });
  }

  find(scope: TenantScope, options: FindManyOptions<T> = {}): Promise<T[]> {
    return this.repository(scope).find({ ...options, where: scopedWhere(scope, options.where) });
  }

  /** Inserts the row under the scope's business. */
  async insert(scope: TenantScope, row: QueryDeepPartialEntity<T>): Promise<void> {
    await this.repository(scope).insert({ ...row, businessId: scope.businessId });
  }

  /** Updates the scope's matching rows and returns how many changed; a row can never move to another business. */
  async update(scope: TenantScope, where: Where<T>, patch: QueryDeepPartialEntity<T>): Promise<number> {
    const result = await this.repository(scope).update(inScope(scope, where), {
      ...patch,
      businessId: scope.businessId,
    });
    return result.affected ?? 0;
  }

  count(scope: TenantScope, where: Where<T> = {}): Promise<number> {
    return this.repository(scope).count({ where: inScope(scope, where) });
  }

  /** A query builder already filtered to the scope's business; see {@link tenantQuery}. */
  query(scope: TenantScope, alias: string): SelectQueryBuilder<T> {
    const query = this.repository(scope)
      .createQueryBuilder(alias)
      .where(`${alias}.businessId = :tenantBusinessId`, { tenantBusinessId: scope.businessId });
    return lockedToTenant(query);
  }

  private repository(scope: TenantScope): Repository<T> {
    return this.connection.getRepository(requestContextOf(scope), this.entity);
  }
}

/** Builds {@link TenantRepository} instances. */
@Injectable()
export class TenantRepositoryFactory {
  constructor(private readonly connection: TransactionalConnection) {}

  for<T extends TenantEntity>(entity: ObjectType<T>): TenantRepository<T> {
    return new TenantRepository(this.connection, entity);
  }
}

/** A select on `repository` limited to the scope's business, for queries its methods cannot express. */
export function tenantQuery<T extends TenantEntity>(
  scope: TenantScope,
  repository: TenantRepository<T>,
  alias: string,
): SelectQueryBuilder<T> {
  return repository.query(scope, alias);
}
