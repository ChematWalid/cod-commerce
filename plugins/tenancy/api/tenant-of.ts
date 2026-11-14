import type { TenantContext } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { TenantContextMissingError } from './tenant-context-missing.error';

const tenants = new WeakMap<object, TenantContext>();

/** Stands in for the request on a context built outside one. `ctx.copy()` keeps own symbols, so copies share it. */
const TENANT_ANCHOR = Symbol('tenantAnchor');

type AnchoredContext = RequestContext & { [TENANT_ANCHOR]?: object };

/** Keyed on the request, not the context: `@Transaction` and `withTransaction` hand handlers a copy (A5). */
const anchorOf = (ctx: AnchoredContext): object | undefined => ctx.req ?? ctx[TENANT_ANCHOR];

/** Records the tenant the guard resolved, for this context and every copy of it. */
export function rememberTenant(ctx: RequestContext, tenant: TenantContext): void {
  const anchored: AnchoredContext = ctx;
  const anchor = anchorOf(anchored) ?? {};
  anchored[TENANT_ANCHOR] = anchor;
  tenants.set(anchor, tenant);
}

/**
 * The tenant already resolved for this context, or `undefined` on any request that did not pass `@TenantScoped()`
 * (and on a scoped one before the guard ran). For code that must also run outside a tenant-scoped request (the tenant
 * guard, the naming strategy, D2106).
 *
 * A caller that gets `undefined` must refuse, or do only what needs no tenant: `undefined` never means "no filter"
 * and must not drive data access. A handler reads its tenant with {@link tenantOf}, which throws instead, and a
 * store's settings with `RequestStoreSettings`, which also limits them to the caller's reachable stores.
 */
export function findTenant(ctx: RequestContext): TenantContext | undefined {
  const anchor = anchorOf(ctx);
  return anchor === undefined ? undefined : tenants.get(anchor);
}

/**
 * The tenant of a request that passed `@TenantScoped()`.
 *
 * @throws {@link TenantContextMissingError} when the guard did not run for this request
 */
export function tenantOf(ctx: RequestContext): TenantContext {
  const tenant = findTenant(ctx);
  if (tenant === undefined) throw new TenantContextMissingError();
  return tenant;
}
