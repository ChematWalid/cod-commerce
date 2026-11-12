import { RequestTenantScope } from '@cod/plugin-tenancy';
import type { BusinessId, TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import type { InboundScopesPort } from '../application/ports';

/**
 * {@link InboundScopesPort} for work that starts from a webhook or a job, where no tenant request exists: an anonymous
 * admin context stands in, and the scope still names the business, so `TenantRepository` filters on it.
 */
@Injectable()
export class VendureInboundScopes implements InboundScopesPort {
  constructor(
    private readonly contexts: RequestContextService,
    private readonly connection: TransactionalConnection,
  ) {}

  async transactional<T>(businessId: BusinessId, work: (scope: TenantScope) => Promise<T>): Promise<T> {
    const ctx = await this.contexts.create({ apiType: 'admin' });
    return this.connection.withTransaction(ctx, (txCtx) => work(new RequestTenantScope(txCtx, businessId)));
  }

  async plain<T>(businessId: BusinessId, work: (scope: TenantScope) => Promise<T>): Promise<T> {
    const ctx = await this.contexts.create({ apiType: 'admin' });
    return work(new RequestTenantScope(ctx, businessId));
  }
}
