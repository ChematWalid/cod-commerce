import type { BusinessId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';
import type { RbacLockPort } from '../domain/ports/rbac-lock.port';
import { BusinessRoleEntity } from './business-role.entity';
import { toRequestContext } from './request-context';

/** Transaction-scoped, so it survives PgBouncer's transaction pooling (ADR 0016 §6). */
const ADVISORY_LOCK_SQL = "SELECT pg_advisory_xact_lock(hashtextextended('rbac:' || $1, 0))";

/** {@link RbacLockPort} on a Postgres advisory lock (D70). */
@Injectable()
export class RbacLock implements RbacLockPort {
  constructor(private readonly connection: TransactionalConnection) {}

  async acquire(ctx: OperationContext, businessId: BusinessId): Promise<void> {
    await this.connection
      .getRepository(toRequestContext(ctx), BusinessRoleEntity)
      .query(ADVISORY_LOCK_SQL, [businessId]);
  }
}
