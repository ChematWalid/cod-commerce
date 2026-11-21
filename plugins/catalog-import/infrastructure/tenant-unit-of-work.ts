import { TenantTransaction } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { asOperationContext, type OperationContext } from '../application/ports/operation-context';
import type { UnitOfWorkPort } from '../application/ports/unit-of-work.port';
import { toRequestContext } from './request-context';

/** {@link UnitOfWorkPort} on tenancy's `TenantTransaction`: catalog's use cases and the activity row join it (D2213). */
@Injectable()
export class TenantUnitOfWork implements UnitOfWorkPort {
  constructor(private readonly transactions: TenantTransaction) {}

  run<T>(ctx: OperationContext, scope: TenantScope, work: (transactional: OperationContext) => Promise<T>): Promise<T> {
    return this.transactions.run(toRequestContext(ctx), scope, (txCtx) => work(asOperationContext(txCtx)));
  }
}
