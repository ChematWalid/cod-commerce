import { RequestTenantScope, type TenantRepository, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { type BuiltInRoleKey, type PermissionKey, type Snowflake, type TenantScope, toSnowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { BusinessRole } from '../domain/business-role';
import type {
  BusinessRolePermissionsPatch,
  BusinessRoleRepositoryPort,
} from '../domain/ports/business-role-repository.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { BusinessRoleEntity } from './business-role.entity';
import { toRequestContext } from './request-context';

function toRole(row: BusinessRoleEntity): BusinessRole {
  return {
    id: toSnowflake(row.id),
    name: row.name,
    nameKey: row.nameKey,
    description: row.description,
    builtInKey: row.builtInKey as BuiltInRoleKey | null,
    permissions: row.permissions as PermissionKey[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** The Postgres adapter of {@link BusinessRoleRepositoryPort}, on `TenantRepository` (ADR 0002). */
@Injectable()
export class TypeOrmBusinessRoleRepository implements BusinessRoleRepositoryPort {
  private readonly rows: TenantRepository<BusinessRoleEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.rows = repositories.for(BusinessRoleEntity);
  }

  async insert(ctx: OperationContext, scope: TenantScope, role: BusinessRole): Promise<void> {
    await this.rows.insert(new RequestTenantScope(toRequestContext(ctx), scope.businessId), {
      ...role,
      permissions: [...role.permissions],
    });
  }

  async updatePermissions(
    ctx: OperationContext,
    scope: TenantScope,
    id: Snowflake,
    { permissions, updatedAt }: BusinessRolePermissionsPatch,
  ): Promise<void> {
    await this.rows.update(
      new RequestTenantScope(toRequestContext(ctx), scope.businessId),
      { id },
      { permissions: [...permissions], updatedAt },
    );
  }

  async all(ctx: OperationContext, scope: TenantScope): Promise<readonly BusinessRole[]> {
    const rows = await this.rows.find(new RequestTenantScope(toRequestContext(ctx), scope.businessId));
    return rows.map(toRole);
  }

  async findBuiltIn(ctx: OperationContext, scope: TenantScope, key: BuiltInRoleKey): Promise<BusinessRole | undefined> {
    const row = await this.rows.findOne(new RequestTenantScope(toRequestContext(ctx), scope.businessId), {
      builtInKey: key,
    });
    return row === null ? undefined : toRole(row);
  }
}
