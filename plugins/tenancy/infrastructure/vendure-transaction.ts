import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { asOperationContext, type OperationContext } from '../domain/ports/operation-context';
import type { TransactionPort } from '../domain/ports/transaction.port';
import { toRequestContext } from './operation-context.adapter';

/** {@link TransactionPort} over Vendure's connection, which joins a transaction the context already carries. */
@Injectable()
export class VendureTransaction implements TransactionPort {
  constructor(private readonly connection: TransactionalConnection) {}

  run<T>(ctx: OperationContext, work: (transactional: OperationContext) => Promise<T>): Promise<T> {
    return this.connection.withTransaction(toRequestContext(ctx), (transactional) =>
      work(asOperationContext(transactional)),
    );
  }
}
