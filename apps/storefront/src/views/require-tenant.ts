import { notFound } from 'next/navigation';
import { isPrerenderSentinel, verifyTenant } from '../tenancy/tenant-verifier-instance';
import type { TenantRouteParams, VerifiedTenant } from '../tenancy/verified-tenant';

/**
 * The verified tenant of a tenant render, the only way a page gets one (#209). The build's prerender sentinel gives
 * `null` (render nothing); a path that does not bind its store to the store's own host renders the soft 404 and
 * never reaches a data loader.
 */
export async function requireTenant(route: TenantRouteParams): Promise<VerifiedTenant | null> {
  if (isPrerenderSentinel(route)) return null;
  const tenant = await verifyTenant(route);
  if (tenant === null) notFound();
  return tenant;
}
