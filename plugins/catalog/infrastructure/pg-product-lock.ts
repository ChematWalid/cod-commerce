import { Injectable } from '@nestjs/common';
import { Product, type RequestContext, TransactionalConnection } from '@vendure/core';
import type { CoreId } from '../domain/core-id';

/**
 * Transaction-scoped, so it survives PgBouncer's transaction pooling. Product ids are global, so the key needs no
 * business; the `catalog-product:` prefix never meets team's `team:` or rbac's `rbac:` keys.
 */
const ADVISORY_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtextextended('catalog-product:' || $1, 0))";

/**
 * Serialises the saves of one product: held until the transaction of `ctx` ends, so a second update, status change or
 * delete of the same product waits and then plans from the first one's committed result.
 */
@Injectable()
export class PgProductLock {
  constructor(private readonly connection: TransactionalConnection) {}

  async acquire(ctx: RequestContext, productId: CoreId): Promise<void> {
    await this.connection.getRepository(ctx, Product).query(ADVISORY_LOCK_SQL, [productId]);
  }
}
