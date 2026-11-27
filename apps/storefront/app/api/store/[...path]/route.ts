import type { NextRequest } from 'next/server';
import { storefrontTrustEdgeIp } from '../../../../src/config/storefront-env';
import { internalFetch } from '../../../../src/lib/internal-api';
import { handleStoreApiRequest, type StoreApiDeps } from '../../../../src/store-api/handle-store-api';
import { resolveStoreFromHost } from '../../../../src/tenancy/resolve-store-from-host';
import { storeResolver } from '../../../../src/tenancy/store-resolver-instance';

const deps: StoreApiDeps = {
  resolveStore: (request) => resolveStoreFromHost(request, storeResolver),
  fetchUpstream: (path, init) => internalFetch(path, init),
  trustEdgeIp: storefrontTrustEdgeIp,
};

/**
 * The same-origin store api of the store's client islands (GET only): the store comes from the `Host` header
 * through the proxy's resolver, never from the client (#209).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  return handleStoreApiRequest(request, path, deps);
}
