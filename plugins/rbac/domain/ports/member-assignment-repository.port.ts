import type { TenantScope } from '@cod/shared';
import type { MemberAssignment } from '../business-role';
import type { OperationContext } from './operation-context';

/** Which members of a tenant hold which roles (D54). */
export interface MemberAssignmentRepositoryPort {
  insert(ctx: OperationContext, scope: TenantScope, assignment: MemberAssignment): Promise<void>;
  /** The distinct administrators holding at least one role on all stores. */
  allStoresAdministratorIds(ctx: OperationContext, scope: TenantScope): Promise<readonly number[]>;
}
