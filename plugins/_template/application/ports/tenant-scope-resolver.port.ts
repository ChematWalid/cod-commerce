import type { TenantScope } from '@cod/shared';

/** Derives the caller's tenant scope from a request; the business never comes from client input (ADR 0002). */
export interface TenantScopeResolver<TContext> {
  resolve(context: TContext): TenantScope;
}
