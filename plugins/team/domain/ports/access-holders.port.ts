import type { TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** Who holds access in a business, as rbac keeps it (D204). */
export interface AccessHoldersPort {
  /** The live administrators of the business holding at least one role assignment. */
  administratorIdsOf(ctx: OperationContext, scope: TenantScope): Promise<readonly number[]>;
}
