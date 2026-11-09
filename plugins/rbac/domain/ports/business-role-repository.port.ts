import type { BuiltInRoleKey, PermissionKey, Snowflake, TenantScope } from '@cod/shared';
import type { BusinessRole } from '../business-role';
import type { OperationContext } from './operation-context';

/** A role's new permissions and when they changed. */
export interface BusinessRolePermissionsPatch {
  readonly permissions: readonly PermissionKey[];
  readonly updatedAt: Date;
}

/** The business roles of a tenant. */
export interface BusinessRoleRepositoryPort {
  insert(ctx: OperationContext, scope: TenantScope, role: BusinessRole): Promise<void>;
  findBuiltIn(ctx: OperationContext, scope: TenantScope, key: BuiltInRoleKey): Promise<BusinessRole | undefined>;
  updatePermissions(
    ctx: OperationContext,
    scope: TenantScope,
    id: Snowflake,
    patch: BusinessRolePermissionsPatch,
  ): Promise<void>;
}
