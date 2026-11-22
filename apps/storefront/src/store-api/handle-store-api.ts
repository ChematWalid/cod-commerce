import type { NextRequest } from 'next/server';
import type { ResolvedStore } from '../tenancy/store-resolver';
import { clientIpOf } from './client-ip';
import { forwardedQueryOf } from './store-api-query';
import { upstreamPathOf } from './store-api-route';

const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const BAD_GATEWAY = 502;

/** No intermediary keeps a store api answer: the host decides the store, and a cache keyed by path would mix them. */
const NO_STORE = 'private, no-store';

/** What an upstream call carries besides its path. */
export interface UpstreamInit {
  readonly storeId: string;
  readonly clientIp?: string;
}

/** What the handler reads: the store of the request's host, the api, and whether the edge address is trusted. */
export interface StoreApiDeps {
  resolveStore(request: NextRequest): Promise<ResolvedStore | null>;
  fetchUpstream(path: string, init: UpstreamInit): Promise<Response>;
  trustEdgeIp(): boolean;
}

function emptyResponse(status: number): Response {
  return new Response(null, { status, headers: { 'Cache-Control': NO_STORE } });
}

async function relay(upstream: Response): Promise<Response> {
  if (upstream.status === NOT_FOUND) return emptyResponse(NOT_FOUND);
  if (!upstream.ok) return emptyResponse(BAD_GATEWAY);
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': NO_STORE },
  });
}

function logUpstreamFailure(path: string, error: unknown): void {
  const errorClass = error instanceof Error ? error.name : typeof error;
  console.error(JSON.stringify({ level: 'error', event: 'storefront.store_api.upstream_failed', path, errorClass }));
}

/** The store of the request's host, or `failed` (logged) when the api could not say: the resolver is upstream too. */
async function resolvedStoreOf(request: NextRequest, deps: StoreApiDeps): Promise<ResolvedStore | null | 'failed'> {
  try {
    return await deps.resolveStore(request);
  } catch (error) {
    logUpstreamFailure('resolve', error);
    return 'failed';
  }
}

/**
 * `GET /api/store/<segments>` for the store's own pages: the store comes from the request `Host` through the same
 * resolver as the proxy, the upstream path from a typed table, the query from an allow-list. A path outside the
 * table or an unknown host is 404, a `storeId` of another store 400, all with an empty body and no upstream call;
 * an upstream failure, store resolution included, is 502 with an empty body, never the api's error text.
 */
export async function handleStoreApiRequest(
  request: NextRequest,
  segments: readonly string[],
  deps: StoreApiDeps,
): Promise<Response> {
  const path = upstreamPathOf(segments);
  if (path === null) return emptyResponse(NOT_FOUND);
  const store = await resolvedStoreOf(request, deps);
  if (store === 'failed') return emptyResponse(BAD_GATEWAY);
  if (store === null) return emptyResponse(NOT_FOUND);
  const forwarded = forwardedQueryOf(request.nextUrl.searchParams, store.storeId);
  if (!forwarded.ok) return emptyResponse(BAD_REQUEST);
  const upstreamPath = forwarded.query === '' ? path : `${path}?${forwarded.query}`;
  const clientIp = clientIpOf(request.headers, deps.trustEdgeIp());
  try {
    const upstream = await deps.fetchUpstream(upstreamPath, {
      storeId: store.storeId,
      ...(clientIp !== undefined && { clientIp }),
    });
    return await relay(upstream);
  } catch (error) {
    logUpstreamFailure(path, error);
    return emptyResponse(BAD_GATEWAY);
  }
}
