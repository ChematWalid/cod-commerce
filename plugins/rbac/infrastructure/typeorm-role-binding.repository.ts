import { RequestTenantScope, type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { type TenantScope, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RoleBinding } from '../domain/business-role';
import { ALL_STORES_SCOPE } from '../domain/constants';
import type { OperationContext } from '../domain/ports/operation-context';
import type { RoleBindingRepositoryPort } from '../domain/ports/role-binding-repository.port';
import { toRequestContext } from './request-context';
import { RoleBindingEntity } from './role-binding.entity';

/** The Postgres adapter of {@link RoleBindingRepositoryPort}, on `TenantRepository` (ADR 0002). */
@Injectable()
export class TypeOrmRoleBindingRepository implements RoleBindingRepositoryPort {
  private readonly rows: TenantRepository<RoleBindingEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(RoleBindingEntity);
  }

  async insert(ctx: OperationContext, scope: TenantScope, binding: RoleBinding): Promise<void> {
    await this.rows.insert(new RequestTenantScope(toRequestContext(ctx), scope.businessId), { ...binding });
  }

  async allStoresBindings(ctx: OperationContext, scope: TenantScope): Promise<readonly RoleBinding[]> {
    const rows = await this.rows.find(new RequestTenantScope(toRequestContext(ctx), scope.businessId), {
      where: { scope: ALL_STORES_SCOPE },
    });
    return rows.map((row) => ({
      id: toSnowflake(row.id),
      businessRoleId: toSnowflake(row.businessRoleId),
      scope: row.scope,
      vendureRoleId: row.vendureRoleId,
    }));
  }
}
