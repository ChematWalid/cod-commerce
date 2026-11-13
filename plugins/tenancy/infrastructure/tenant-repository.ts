import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { FindManyOptions, FindOptionsWhere, ObjectType, Repository, SelectQueryBuilder } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TenantScopeMissingError } from '../domain/errors';
import { requestContextOf } from './request-tenant-scope';
import { lockToTenant, TENANT_BUSINESS_PARAMETER } from './tenant-query-lock';
import type { TenantEntity } from './tenant.entity';

type Where<T> = FindOptionsWhere<T>;

const inScope = <T>(scope: TenantScope, where: Where<T> = {}): Where<T> => ({ ...where, businessId: scope.businessId });

/** An empty array means "no filter" to TypeORM, so it must not skip the business condition. */
function scopedWhere<T>(scope: TenantScope, where?: Where<T> | Where<T>[]): Where<T> | Where<T>[] {
  if (!Array.isArray(where)) return inScope(scope, where);
  return where.length === 0 ? inScope(scope) : where.map((alternative) => inScope(scope, alternative));
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

  /** Deletes the scope's rows matching `where`; `where` must name them, an empty filter would mean every row. */
  async delete(scope: TenantScope, where: Where<T>): Promise<number> {
    const result = await this.repository(scope).delete(inScope(scope, where));
    return result.affected ?? 0;
  }

  count(scope: TenantScope, where: Where<T> = {}): Promise<number> {
    return this.repository(scope).count({ where: inScope(scope, where) });
  }

  /** A query builder already filtered to the scope's business; see {@link tenantQuery}. */
  query(scope: TenantScope, alias: string): SelectQueryBuilder<T> {
    const query = this.repository(scope)
      .createQueryBuilder(alias)
      .where(`${alias}.businessId = :${TENANT_BUSINESS_PARAMETER}`, { [TENANT_BUSINESS_PARAMETER]: scope.businessId });
    return lockToTenant(query, scope.businessId);
  }

  /** True when the scope's context holds an active transaction, so a write through it commits or rolls back with it. */
  inTransaction(scope: TenantScope): boolean {
    return this.repository(scope).queryRunner?.isTransactionActive === true;
  }

  private repository(scope: TenantScope): Repository<T> {
    if (!scope.businessId) throw new TenantScopeMissingError();
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
