import { Injectable } from '@nestjs/common';
import { Product, TransactionalConnection } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { PackLockPort } from '../domain/ports/pack-lock.port';
import { toRequestContext } from './request-scope';

/**
 * Transaction-scoped, so it survives PgBouncer's transaction pooling. Product ids are global, so the key needs no
 * business; the `catalog-pack:` prefix never meets catalog's `catalog-product:` keys. Lock order (D2282): a pack save
 * takes its one pack lock, then catalog's locks on that pack and its components; a recompute delivery holds every
 * lock until it commits, so it takes `catalog-pack:P1`, `catalog-product:P1`, then `catalog-pack:P2`, a pack lock
 * after a product lock. That is deadlock-free only because packs are locked in ascending pack id (`holding`) and a
 * pack can never be a component (`pack-rules.ts`), so no holder of `catalog-pack:P2` ever waits for
 * `catalog-product:P1`. Nested packs or another lock order would break this.
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
