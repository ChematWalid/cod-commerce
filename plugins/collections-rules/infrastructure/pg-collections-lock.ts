import { Injectable } from '@nestjs/common';
import { Collection, TransactionalConnection } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreLockPort } from '../domain/ports/store-lock.port';
import { toRequestContext } from './request-scope';

/**
 * Transaction-scoped, so it survives PgBouncer's transaction pooling. Store ids are global snowflakes, so the key
 * needs no business; the `collections-store:` prefix never meets catalog's `catalog-product:` keys (D2334).
 */
const ADVISORY_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtextextended('collections-store:' || $1, 0))";

/** A store lock asked for outside a transaction: it would be released at once and serialise nothing. */
export class StoreLockOutsideTransactionError extends Error {
  constructor() {
    super('The collections store lock must be taken inside a transaction');
    this.name = 'StoreLockOutsideTransactionError';
  }
}

/**
 * Serialises the membership writers of one store (D2334): held until the transaction of `ctx` ends, so a second
 * writer of the same store waits and then reads the first one's committed rules, facts and members. Writers of two
 * stores never wait for each other. Lock order is always catalog product lock, then this one.
 */
@Injectable()
export class PgCollectionsLock implements StoreLockPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async lockStore(ctx: OperationContext, storeId: string): Promise<void> {
    // Any entity gives the repository of the context's query runner; `Collection` is the one this lock guards.
    const repository = this.connection.getRepository(toRequestContext(ctx), Collection);
    if (repository.queryRunner?.isTransactionActive !== true) throw new StoreLockOutsideTransactionError();
    await repository.query(ADVISORY_LOCK_SQL, [storeId]);
  }
}
