import { TenantTransaction } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { asOperationContext, type OperationContext } from '../domain/ports/operation-context';
import type { TransactionPort } from '../domain/ports/transaction.port';
import { toRequestContext } from './request-scope';

/** {@link TransactionPort} on tenancy's `TenantTransaction`. */
@Injectable()
export class TransactionAdapter implements TransactionPort {
  constructor(private readonly transactions: TenantTransaction) {}

  run<T>(ctx: OperationContext, scope: TenantScope, work: (transactional: OperationContext) => Promise<T>): Promise<T> {
    return this.transactions.run(toRequestContext(ctx), scope, (txCtx) => work(asOperationContext(txCtx)));
  }
}
