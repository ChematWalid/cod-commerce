import { sitemapResponse } from '../../../../../../src/seo/seo-routes';
import type { TenantRouteParams } from '../../../../../../src/tenancy/verified-tenant';

/** The store's sitemap: from the tenant path and the cached catalog, never from the request's headers. */
export async function GET(_request: Request, { params }: { params: Promise<TenantRouteParams> }): Promise<Response> {
  return sitemapResponse(await params);
}
