import type { NextRequest, NextResponse } from 'next/server';
import { resolveStoreFromHost } from './src/tenancy/resolve-store-from-host';
import { rewriteToTenantPath } from './src/tenancy/rewrite-to-tenant-path';
import { storeResolver } from './src/tenancy/store-resolver-instance';

/** Resolves the store from the `Host` header and rewrites to its internal path (ADR 0006). */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const store = await resolveStoreFromHost(request, storeResolver);
  return rewriteToTenantPath(request, store);
}

// API routes, the health probes and static assets answer for any host, without a store.
export const config = {
  matcher: ['/((?!api/|livez|readyz|_next/static|_next/image|favicon.ico).*)'],
};
