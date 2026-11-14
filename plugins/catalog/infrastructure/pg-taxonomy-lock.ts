import type { Snowflake } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { Product, TransactionalConnection } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TaxonomyLockPort } from '../domain/ports/taxonomy-lock.port';
import { toRequestContext } from './request-scope';

/**
 * Transaction-scoped, so it survives PgBouncer's transaction pooling. Brand, tag and highlight ids are snowflakes of
 * one generator, so the key needs neither the kind nor the business; the prefix keeps it apart from
 * `catalog-product:`, team's and rbac's keys.
 */
const KEY = "hashtextextended('catalog-taxonomy:' || $1, 0)";
const SHARED_LOCK_SQL = `SELECT pg_advisory_xact_lock_shared(${KEY})`;
const EXCLUSIVE_LOCK_SQL = `SELECT pg_advisory_xact_lock(${KEY})`;

/** {@link TaxonomyLockPort} on Postgres advisory locks held until the transaction ends. */
@Injectable()
export class PgTaxonomyLock implements TaxonomyLockPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async share(ctx: OperationContext, ids: readonly Snowflake[]): Promise<void> {
    // One order for every save, so two saves waiting behind deletes never wait on each other's locks.
    for (const id of [...new Set(ids)].sort()) await this.run(ctx, SHARED_LOCK_SQL, id);
  }

  async exclusive(ctx: OperationContext, id: Snowflake): Promise<void> {
    await this.run(ctx, EXCLUSIVE_LOCK_SQL, id);
  }

  private async run(ctx: OperationContext, sql: string, id: Snowflake): Promise<void> {
    await this.connection.getRepository(toRequestContext(ctx), Product).query(sql, [id]);
  }
}
