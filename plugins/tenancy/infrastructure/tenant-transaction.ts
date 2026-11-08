import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { type RequestContext, TransactionalConnection } from '@vendure/core';
import { BusinessEntity } from './business.entity';

/** `is_local = true`: PgBouncer reuses backends between clients, so the setting must end with the transaction. */
const SET_TENANT_SQL = "SELECT set_config('app.business_id', $1, true)";

/** Runs work in a transaction that carries the tenant in Postgres, for row-level policies (ADR 0016 §6). */
@Injectable()
export class TenantTransaction {
  constructor(private readonly connection: TransactionalConnection) {}

  run<T>(ctx: RequestContext, scope: TenantScope, work: (txCtx: RequestContext) => Promise<T>): Promise<T> {
    return this.connection.withTransaction(ctx, async (txCtx) => {
      await this.connection.getRepository(txCtx, BusinessEntity).query(SET_TENANT_SQL, [scope.businessId]);
      return work(txCtx);
    });
  }
}
