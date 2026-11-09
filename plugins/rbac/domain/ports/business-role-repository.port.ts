import type { BuiltInRoleKey, TenantScope } from '@cod/shared';
import type { BusinessRole } from '../business-role';
import type { OperationContext } from './operation-context';

/** The business roles of a tenant. */
export interface BusinessRoleRepositoryPort {
  insert(ctx: OperationContext, scope: TenantScope, role: BusinessRole): Promise<void>;
  findBuiltIn(ctx: OperationContext, scope: TenantScope, key: BuiltInRoleKey): Promise<BusinessRole | undefined>;
}
