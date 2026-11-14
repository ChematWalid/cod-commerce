import { Injectable } from '@nestjs/common';
import { Product, TransactionalConnection } from '@vendure/core';
import type { CoreId } from '../domain/core-id';
import type { MediaLockPort } from '../domain/ports/media-lock.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-scope';

/**
 * Transaction-scoped, so it survives PgBouncer's transaction pooling. Asset ids are Vendure's integers, unique across
 * businesses, so the key needs no business; the prefix keeps it apart from `catalog-taxonomy:`, `catalog-product:`,
 * team's and rbac's keys.
 */
const KEY = "hashtextextended('catalog-media:' || $1, 0)";
const SHARED_LOCK_SQL = `SELECT pg_advisory_xact_lock_shared(${KEY})`;
const EXCLUSIVE_LOCK_SQL = `SELECT pg_advisory_xact_lock(${KEY})`;

/** {@link MediaLockPort} on Postgres advisory locks held until the transaction ends. */
@Injectable()
export class PgMediaLock implements MediaLockPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async share(ctx: OperationContext, assetIds: readonly CoreId[]): Promise<void> {
    // One order for every save, so two saves waiting behind deletes never wait on each other's locks.
    for (const id of [...new Set(assetIds)].sort()) await this.run(ctx, SHARED_LOCK_SQL, id);
  }

  async exclusive(ctx: OperationContext, assetId: CoreId): Promise<void> {
    await this.run(ctx, EXCLUSIVE_LOCK_SQL, assetId);
  }

  private async run(ctx: OperationContext, sql: string, id: CoreId): Promise<void> {
    await this.connection.getRepository(toRequestContext(ctx), Product).query(sql, [id]);
  }
}
