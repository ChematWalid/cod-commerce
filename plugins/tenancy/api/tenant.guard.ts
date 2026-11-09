import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { internal_getRequestContext, parseContext, type RequestContext } from '@vendure/core';
import type { TenantContextResolverPort } from '../application/ports/tenant-context-resolver.port';
import { TENANT_CONTEXT_RESOLVER } from '../application/tokens';
import { TenantContextMissingError } from './tenant-context-missing.error';
import { findTenant, rememberTenant } from './tenant-of';

/** Lets a request through only with a tenant, and records it for `tenantOf`. Fails closed (ADR 0002). */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(TENANT_CONTEXT_RESOLVER) private readonly resolver: TenantContextResolverPort<RequestContext>) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    const { req } = parseContext(execution);
    const ctx = internal_getRequestContext(req, execution);
    if (findTenant(ctx) !== undefined) return true;
    const tenant = await this.resolver.resolve(ctx);
    if (tenant === undefined) throw new TenantContextMissingError();
    rememberTenant(ctx, tenant);
    return true;
  }
}
