import type { NextRequest } from 'next/server';
import { normalizeHost } from './host';
import type { ResolvedStore, StoreResolver } from './store-resolver';

/**
 * The active store of a request's `Host` header. `X-Forwarded-Host` is never read: a client could set it,
 * and the edge passes the buyer's host in `Host` itself.
 *
 * @returns `null` for a missing or unknown host and for a disabled store
 */
export async function resolveStoreFromHost(
  request: NextRequest,
  resolver: StoreResolver,
): Promise<ResolvedStore | null> {
  const host = normalizeHost(request.headers.get('host'));
  if (!host) return null;
  const store = await resolver.resolveByHost(host);
  return store?.status === 'active' ? store : null;
}
