import type { TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';

/**
 * Tells whether a member is deactivated by a feature that owns member status (D204: Team). rbac asks it before granting
 * roles, so a role grant cannot silently undo a deactivation. Read inside the caller's transaction.
 */
export interface MemberSuspensionCheck {
  isSuspended(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<boolean>;
}
