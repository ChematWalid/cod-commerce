import type { BusinessId, TenantContext } from '@cod/shared';

/** Derives what a request may touch; the business never comes from client input (ADR 0002). */
export interface TenantContextResolverPort<TContext> {
  /** The tenant of the request, or `undefined` when it has none: callers must fail closed. */
  resolve(context: TContext): Promise<TenantContext | undefined>;

  /**
   * The business of the signed-in administrator when it is active, whatever the request's channel is. Unlike
   * {@link resolve} it needs no accessible active store, so it answers while the active channel is archived.
   */
  activeBusinessOf(context: TContext): Promise<BusinessId | undefined>;
}
