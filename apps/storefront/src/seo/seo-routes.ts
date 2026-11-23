import { isPrerenderSentinel, verifyTenant } from '../tenancy/tenant-verifier-instance';
import type { TenantRouteParams } from '../tenancy/verified-tenant';
import { robotsTxt, sitemapXml } from './sitemap';

const NOT_FOUND = 404;

/** The edge may keep these for an hour; a store change purges them with the store's pages (D3210). */
const SEO_CACHE_CONTROL = 'public, max-age=3600';

function notFoundResponse(): Response {
  return new Response(null, { status: NOT_FOUND });
}

/** `GET /sitemap.xml` of the store the tenant path names, or 404 without a valid host binding. */
export async function sitemapResponse(route: TenantRouteParams): Promise<Response> {
  if (isPrerenderSentinel(route)) return notFoundResponse();
  const tenant = await verifyTenant(route);
  if (tenant === null) return notFoundResponse();
  return new Response(await sitemapXml(tenant), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': SEO_CACHE_CONTROL },
  });
}

/** `GET /robots.txt` of the store the tenant path names, or 404 without a valid host binding. */
export async function robotsResponse(route: TenantRouteParams): Promise<Response> {
  if (isPrerenderSentinel(route)) return notFoundResponse();
  const tenant = await verifyTenant(route);
  if (tenant === null) return notFoundResponse();
  return new Response(robotsTxt(tenant.store), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': SEO_CACHE_CONTROL },
  });
}
