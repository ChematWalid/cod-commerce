import type { TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';

/**
 * Serialises Team's writes of one business for the rest of the current transaction (D213). Every Team use case that
 * changes rbac access takes it first, before any rbac lock, so two orders of locking never meet.
 */
export interface BusinessLockPort {
  acquire(ctx: OperationContext, scope: TenantScope): Promise<void>;
}
