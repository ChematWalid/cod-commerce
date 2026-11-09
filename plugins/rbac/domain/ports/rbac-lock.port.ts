import type { BusinessId } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** Serialises the role and assignment writes of one business (D70). */
export interface RbacLockPort {
  /** Holds the lock until the transaction `ctx` carries ends, so `ctx` must carry one. */
  acquire(ctx: OperationContext, businessId: BusinessId): Promise<void>;
}
