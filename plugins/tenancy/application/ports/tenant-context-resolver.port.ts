import type { TenantContext } from '@cod/shared';

/** Derives what a request may touch; the business never comes from client input (ADR 0002). */
export interface TenantContextResolverPort<TContext> {
  /** The tenant of the request, or `undefined` when it has none: callers must fail closed. */
  resolve(context: TContext): Promise<TenantContext | undefined>;
}
