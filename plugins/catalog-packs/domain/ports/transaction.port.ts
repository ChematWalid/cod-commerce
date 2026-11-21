import type { TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** Runs work atomically for one business; it joins the transaction `ctx` already carries, if any. */
export interface TransactionPort {
  run<T>(ctx: OperationContext, scope: TenantScope, work: (transactional: OperationContext) => Promise<T>): Promise<T>;
}
