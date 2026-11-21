import { RandomAssetNamingStrategy } from '@cod/plugin-auth';
import { findTenant } from '@cod/plugin-tenancy';
import { type TenantKeyScope, tenantObjectKey } from '@cod/shared';
import type { RequestContext } from '@vendure/core';

/** Where an upload of `ctx` belongs: its business and active store, or nothing for a platform upload. */
export type TenantKeyLookup = (ctx: RequestContext) => TenantKeyScope | undefined;

/** The tenant the request's guard resolved (D2106); a request that passed no `@TenantScoped()` has none. */
const requestTenantKey: TenantKeyLookup = (ctx) => {
  const tenant = findTenant(ctx);
  if (tenant === undefined) return undefined;
  return { businessId: tenant.businessId, storeId: tenant.activeStoreId };
};

/**
 * Puts every tenant file under its tenant's object prefix (ADR 0002 §5, #210, D2113): `b/{business}/s/{store}/` for
 * an upload made in a store, `b/{business}/` for a tenant without an active store, nothing for a platform upload.
 * The random names of {@link RandomAssetNamingStrategy} stay below the prefix, so a key is neither guessable nor
 * shared between tenants, and a bucket policy or a cleanup job can address one tenant's files by prefix.
 */
export class TenantAssetNamingStrategy extends RandomAssetNamingStrategy {
  constructor(private readonly tenantKeyOf: TenantKeyLookup = requestTenantKey) {
    super();
  }

  override generateSourceFileName(ctx: RequestContext, originalFileName: string): string {
    return this.prefixed(ctx, super.generateSourceFileName(ctx, originalFileName));
  }

  /** The parent takes the base name of the source, so a prefixed source still gives the same preview name. */
  override generatePreviewFileName(ctx: RequestContext, sourceFileName: string): string {
    return this.prefixed(ctx, super.generatePreviewFileName(ctx, sourceFileName));
  }

  private prefixed(ctx: RequestContext, name: string): string {
    const tenant = this.tenantKeyOf(ctx);
    if (tenant === undefined) return name;
    const [first = name, ...rest] = name.split('/');
    // `tenantObjectKey` checks every part, so no name can climb out of the tenant's prefix (D2144).
    return tenantObjectKey(tenant, first, ...rest);
  }
}
