import type { OperationContext } from './operation-context';

/** Runs work atomically; it joins the transaction `ctx` already carries, if any. */
export interface TransactionPort {
  run<T>(ctx: OperationContext, work: (transactional: OperationContext) => Promise<T>): Promise<T>;
}
