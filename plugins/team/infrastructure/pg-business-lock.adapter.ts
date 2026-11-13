import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { BusinessLockPort } from '../domain/ports/business-lock.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { TeamMemberEntity } from './team-member.entity';
import { toRequestContext } from './request-scope';

/** Transaction-scoped, so it survives PgBouncer's transaction pooling; a `team:` key never meets rbac's `rbac:` one. */
const ADVISORY_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtextextended('team:' || $1, 0))";

/** {@link BusinessLockPort} on a Postgres advisory lock held until the current transaction ends (D213). */
@Injectable()
export class PgBusinessLock implements BusinessLockPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async acquire(ctx: OperationContext, scope: TenantScope): Promise<void> {
    await this.connection
      .getRepository(toRequestContext(ctx), TeamMemberEntity)
      .query(ADVISORY_LOCK_SQL, [scope.businessId]);
  }
}
