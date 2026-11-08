import type { BusinessId, TenantScope } from '@cod/shared';
import type { RequestContext } from '@vendure/core';

/** The tenant scope of an API request. It carries the request's context, so adapters join its transaction. */
export class RequestTenantScope implements TenantScope {
  constructor(
    readonly ctx: RequestContext,
    readonly businessId: BusinessId,
  ) {}
}

/** The request context a scope carries, or `undefined` for a scope made outside a request (a test, a job). */
export function requestContextOf(scope: TenantScope): RequestContext | undefined {
  return scope instanceof RequestTenantScope ? scope.ctx : undefined;
}
