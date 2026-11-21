import type { Snowflake, TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { Product, TransactionalConnection } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { TaxonomyLockPort } from '../domain/ports/taxonomy-lock.port';
import { toRequestContext } from './request-scope';

/**
 * Transaction-scoped, so it survives PgBouncer's transaction pooling. Brand, tag and highlight ids are snowflakes of
 * one generator, so the key needs no kind; it carries the caller's business, so naming another business's id never
 * holds that business's lock (a save and a delete of one entry always run in its business). The prefix keeps it apart
 * from `catalog-product:`, team's and rbac's keys.
 */
const KEY = "hashtextextended('catalog-taxonomy:' || $1 || ':' || $2, 0)";
const SHARED_LOCK_SQL = `SELECT pg_advisory_xact_lock_shared(${KEY})`;
const EXCLUSIVE_LOCK_SQL = `SELECT pg_advisory_xact_lock(${KEY})`;

/** {@link TaxonomyLockPort} on Postgres advisory locks held until the transaction ends. */
@Injectable()
export class PgTaxonomyLock implements TaxonomyLockPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async share(ctx: OperationContext, scope: TenantScope, ids: readonly Snowflake[]): Promise<void> {
    // One order for every save, so two saves waiting behind deletes never wait on each other's locks.
    for (const id of [...new Set(ids)].sort()) await this.run(ctx, SHARED_LOCK_SQL, scope, id);
  }

  async exclusive(ctx: OperationContext, scope: TenantScope, id: Snowflake): Promise<void> {
    await this.run(ctx, EXCLUSIVE_LOCK_SQL, scope, id);
  }

  private async run(ctx: OperationContext, sql: string, scope: TenantScope, id: Snowflake): Promise<void> {
    await this.connection.getRepository(toRequestContext(ctx), Product).query(sql, [scope.businessId, id]);
  }
}
