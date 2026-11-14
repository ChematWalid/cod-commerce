import { RequestTenantScope } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context';

/** The Vendure context behind an {@link OperationContext}, which only this layer knows about. */
export const toRequestContext = (ctx: OperationContext): RequestContext => ctx as unknown as RequestContext;

/** The scope of a repository call that joins the transaction `ctx` carries. */
export const requestScope = (ctx: OperationContext, scope: TenantScope): TenantScope =>
  new RequestTenantScope(toRequestContext(ctx), scope.businessId);
