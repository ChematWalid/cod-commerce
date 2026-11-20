import { RequestTenantScope, type TenantTransaction } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import type { OperationContext } from '../domain/ports/operation-context.port';

/** The Vendure context behind an {@link OperationContext}, which only this layer knows about. */
export const toRequestContext = (ctx: OperationContext): RequestContext => ctx as unknown as RequestContext;

/** The scope of a repository call that joins the transaction `ctx` carries. */
export const requestScope = (ctx: OperationContext, scope: TenantScope): TenantScope =>
  new RequestTenantScope(toRequestContext(ctx), scope.businessId);

/** Runs `work` in one tenant transaction (joining the one `ctx` carries), handing it the scope of its calls. */
export function inTenantTransaction<T>(
  transaction: TenantTransaction,
  ctx: OperationContext,
  scope: TenantScope,
  work: (tenant: TenantScope) => Promise<T>,
): Promise<T> {
  return transaction.run(toRequestContext(ctx), scope, (txCtx) =>
    work(new RequestTenantScope(txCtx, scope.businessId)),
  );
}
