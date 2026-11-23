import type { NextRequest, NextResponse } from 'next/server';
import { internalSigningKey, storefrontTrustEdgeIp } from './src/config/storefront-env';
import { clientIpOf } from './src/store-api/client-ip';
import { hostBindingOf } from './src/tenancy/host-binding';
import { resolveStoreFromHost } from './src/tenancy/resolve-store-from-host';
import { type HostBinder, rewriteToTenantPath } from './src/tenancy/rewrite-to-tenant-path';
import { storeResolver } from './src/tenancy/store-resolver-instance';

/** Signs host bindings with the active internal key, read per request like every other env value. */
const bindWithActiveKey: HostBinder = (storeId, host) => hostBindingOf(internalSigningKey(), storeId, host);

/**
 * Resolves the store from the `Host` header and rewrites to its internal path, bound to the host by an HMAC the
 * tenant layout checks (ADR 0006, D3202). The trusted edge buyer address goes to uncached pages only (D3213).
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const store = await resolveStoreFromHost(request, storeResolver);
  const buyerIp = clientIpOf(request.headers, storefrontTrustEdgeIp());
  return rewriteToTenantPath(request, store, bindWithActiveKey, buyerIp);
}

// API routes, the health probes and static assets answer for any host, without a store. The probes and the
// favicon are matched as whole segments, so a page such as /livez-sale still goes through the proxy. `/api/internal`
// is therefore not refused here: the edge blocks it and the revalidate route checks its HMAC (D3211).
export const config = {
  matcher: ['/((?!api/|livez(?:/|$)|readyz(?:/|$)|_next/static|_next/image|favicon\\.ico(?:/|$)).*)'],
};
