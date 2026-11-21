import type { TenantScope } from '@cod/shared';
import type { OperationContext } from '../../domain/ports/operation-context';
import type { TransactionPort } from '../../domain/ports/transaction.port';

/** Runs the work at once, with the caller's context: the fakes keep no transaction. */
export class InlineTransaction implements TransactionPort {
  runs = 0;

  run<T>(
    ctx: OperationContext,
    _scope: TenantScope,
    work: (transactional: OperationContext) => Promise<T>,
  ): Promise<T> {
    this.runs += 1;
    return work(ctx);
  }
}
