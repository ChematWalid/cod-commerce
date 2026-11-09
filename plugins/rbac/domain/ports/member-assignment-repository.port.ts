import type { Snowflake, TenantScope } from '@cod/shared';
import type { MemberAssignment } from '../business-role';
import type { OperationContext } from './operation-context';

/** Which members of a tenant hold which roles (D54). */
export interface MemberAssignmentRepositoryPort {
  insert(ctx: OperationContext, scope: TenantScope, assignment: MemberAssignment): Promise<void>;
  isAssigned(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
    businessRoleId: Snowflake,
  ): Promise<boolean>;
  /** The roles this administrator holds. */
  ofAdministrator(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
  ): Promise<readonly MemberAssignment[]>;
  /** Every holder's row of these roles. */
  ofRoles(
    ctx: OperationContext,
    scope: TenantScope,
    businessRoleIds: readonly Snowflake[],
  ): Promise<readonly MemberAssignment[]>;
  /** Replaces every row of this administrator with `assignments`. */
  replaceFor(
    ctx: OperationContext,
    scope: TenantScope,
    administratorId: number,
    assignments: readonly MemberAssignment[],
  ): Promise<void>;
  /** The distinct administrators holding at least one of these roles, on any stores. */
  holdersOf(
    ctx: OperationContext,
    scope: TenantScope,
    businessRoleIds: readonly Snowflake[],
  ): Promise<readonly number[]>;
  /** The distinct administrators holding at least one role on all stores. */
  allStoresAdministratorIds(ctx: OperationContext, scope: TenantScope): Promise<readonly number[]>;
}
