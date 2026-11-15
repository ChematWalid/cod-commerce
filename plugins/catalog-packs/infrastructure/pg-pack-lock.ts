import { Injectable } from '@nestjs/common';
import { Product, TransactionalConnection } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { PackLockPort } from '../domain/ports/pack-lock.port';
import { toRequestContext } from './request-scope';

/**
 * Transaction-scoped, so it survives PgBouncer's transaction pooling. Product ids are global, so the key needs no
 * business; the `catalog-pack:` prefix never meets catalog's `catalog-product:` key, which a pack write takes after
 * this one (always in that order, so the two never deadlock).
 */
const ADVISORY_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtextextended('catalog-pack:' || $1, 0))";

/** {@link PackLockPort} on a Postgres advisory lock; it touches no tenant table (ADR 0002). */
@Injectable()
export class PgPackLock implements PackLockPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async acquire(ctx: OperationContext, productId: string): Promise<void> {
    await this.connection.getRepository(toRequestContext(ctx), Product).query(ADVISORY_LOCK_SQL, [productId]);
  }
}
