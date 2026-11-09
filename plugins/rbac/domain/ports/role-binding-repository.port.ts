import type { TenantScope } from '@cod/shared';
import type { RoleBinding } from '../business-role';
import type { OperationContext } from './operation-context';

/** The Vendure Roles that project a tenant's business roles (D53). */
export interface RoleBindingRepositoryPort {
  insert(ctx: OperationContext, scope: TenantScope, binding: RoleBinding): Promise<void>;
  /** Every binding of the business, whatever its scope. */
  allBindings(ctx: OperationContext, scope: TenantScope): Promise<readonly RoleBinding[]>;
  /** Every binding of the business with the `all` scope. */
  allStoresBindings(ctx: OperationContext, scope: TenantScope): Promise<readonly RoleBinding[]>;
}
