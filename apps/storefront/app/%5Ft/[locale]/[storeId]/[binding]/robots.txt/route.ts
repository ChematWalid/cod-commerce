import { robotsResponse } from '../../../../../../src/seo/seo-routes';
import type { TenantRouteParams } from '../../../../../../src/tenancy/verified-tenant';

/** The store's robots.txt: from the tenant path and the store record, never from the request's headers. */
export async function GET(_request: Request, { params }: { params: Promise<TenantRouteParams> }): Promise<Response> {
  return robotsResponse(await params);
}
