import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { BUYER_IP_QUERY_PARAM, buyerIpOfQuery, clientIpOf } from '../../src/store-api/client-ip';
import { handleStoreApiRequest, type StoreApiDeps } from '../../src/store-api/handle-store-api';
import { upstreamPathOf } from '../../src/store-api/store-api-route';
import type { NormalizedHost } from '../../src/tenancy/host';
import type { ResolvedStore } from '../../src/tenancy/store-resolver';

const STORE_A: ResolvedStore = {
  storeId: '1001',
  businessId: '1',
  name: 'Store A',
  logo: null,
  defaultLocale: 'ar',
  primaryHost: 'a.localhost' as NormalizedHost,
  status: 'active',
};
const STORE_B_ID = '2002';

function depsWith(overrides: Partial<StoreApiDeps> = {}) {
  const fetchUpstream = vi.fn<StoreApiDeps['fetchUpstream']>(() => Promise.resolve(Response.json({ items: [] })));
  const resolveStore = vi.fn<StoreApiDeps['resolveStore']>(() => Promise.resolve(STORE_A));
  const deps: StoreApiDeps = { fetchUpstream, resolveStore, trustEdgeIp: () => false, ...overrides };
  return { deps, fetchUpstream, resolveStore };
}

/** A same-origin store api call on host A; `path` is the raw path after `/api/store/`. */
function call(path: string, headers: Record<string, string> = {}): { request: NextRequest; segments: string[] } {
  const request = new NextRequest(`http://a.localhost:3001/api/store/${path}`, {
    headers: { host: 'a.localhost', ...headers },
  });
  // Next hands the route the catch-all segments decoded, as here.
  const segments = request.nextUrl.pathname.slice('/api/store/'.length).split('/').map(decodeURIComponent);
  return { request, segments };
}

describe('same-origin store api route table', () => {
  it.each([
    [['products'], '/store/products'],
    [['product', 'search'], '/store/product/search'],
    [['product', 'wool-scarf'], '/store/product/wool-scarf'],
    [['collections'], '/store/collections'],
    [['collection', 'kitchen'], '/store/collection/kitchen'],
  ])('maps %j to %s', (segments, upstream) => {
    expect(upstreamPathOf(segments)).toBe(upstream);
  });

  it.each([
    [[]],
    [['by-id', '1001']],
    [['resolve']],
    [['product']],
    [['products', 'x']],
    [['product', 'a', 'b']],
    [['Product', 'x']],
  ])('refuses %j, a path outside the table', (segments) => {
    expect(upstreamPathOf(segments)).toBeNull();
  });
});

describe('same-origin store api', () => {
  it.each(['product/..%2F..%2Fshop-api', 'product/a%2Fb', 'product/a.b', 'product/%2e%2e', 'admin-api', 'product/A'])(
    'answers 404 for %s with no upstream call',
    async (path) => {
      // Arrange
      const { deps, fetchUpstream } = depsWith();
      const { request, segments } = call(path);
      // Act
      const response = await handleStoreApiRequest(request, segments, deps);
      // Assert
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('');
      expect(fetchUpstream).not.toHaveBeenCalled();
    },
  );

  it('reads the store from the host and builds the upstream path from the table, never the client path', async () => {
    // Arrange
    const { deps, fetchUpstream } = depsWith();
    const { request, segments } = call('product/wool-scarf');
    // Act
    const response = await handleStoreApiRequest(request, segments, deps);
    // Assert
    expect(response.status).toBe(200);
    expect(fetchUpstream).toHaveBeenCalledWith('/store/product/wool-scarf', { storeId: STORE_A.storeId });
  });

  it("answers 400 with an empty body for another store's id on host A", async () => {
    // Arrange
    const { deps, fetchUpstream } = depsWith();
    const { request, segments } = call(`products?storeId=${STORE_B_ID}`);
    // Act
    const response = await handleStoreApiRequest(request, segments, deps);
    // Assert
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('');
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it('forwards only allow-listed, valid query params', async () => {
    // Arrange
    const { deps, fetchUpstream } = depsWith();
    const query = `skip=24&take=12&sort=price-asc&collection=kitchen&q=x&storeId=${STORE_A.storeId}&channel=__default&sort2=1`;
    const { request, segments } = call(`products?${query}`);
    // Act
    await handleStoreApiRequest(request, segments, deps);
    // Assert
    expect(fetchUpstream.mock.calls[0]?.[0]).toBe(
      '/store/products?skip=24&take=12&sort=price-asc&q=x&collection=kitchen',
    );
  });

  it('drops invalid values of allow-listed params', async () => {
    // Arrange
    const { deps, fetchUpstream } = depsWith();
    const { request, segments } = call('products?skip=-1&take=1e9&sort=cheap&collection=..%2Fx');
    // Act
    await handleStoreApiRequest(request, segments, deps);
    // Assert
    expect(fetchUpstream.mock.calls[0]?.[0]).toBe('/store/products');
  });

  it('answers 404 for an unknown host without an upstream call', async () => {
    // Arrange
    const { deps, fetchUpstream } = depsWith({ resolveStore: () => Promise.resolve(null) });
    const { request, segments } = call('products');
    // Act
    const response = await handleStoreApiRequest(request, segments, deps);
    // Assert
    expect(response.status).toBe(404);
    expect(fetchUpstream).not.toHaveBeenCalled();
  });

  it('passes a 404 through with an empty body and answers 502 for an upstream failure', async () => {
    // Arrange
    const notFound = depsWith({ fetchUpstream: () => Promise.resolve(new Response('{"raw":"x"}', { status: 404 })) });
    const failing = depsWith({ fetchUpstream: () => Promise.reject(new TypeError('fetch failed')) });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const first = call('product/gone');
    const second = call('products');
    // Act
    const missing = await handleStoreApiRequest(first.request, first.segments, notFound.deps);
    const broken = await handleStoreApiRequest(second.request, second.segments, failing.deps);
    // Assert
    expect([missing.status, await missing.text()]).toEqual([404, '']);
    expect([broken.status, await broken.text()]).toEqual([502, '']);
  });

  it('answers 502 with an empty body and logs when the store cannot be resolved', async () => {
    // Arrange
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const resolveStore = vi.fn<StoreApiDeps['resolveStore']>(() => Promise.reject(new Error('api down')));
    const { deps, fetchUpstream } = depsWith({ resolveStore });
    const { request, segments } = call('products');
    // Act
    const response = await handleStoreApiRequest(request, segments, deps);
    // Assert
    expect(response.status).toBe(502);
    expect(await response.text()).toBe('');
    expect(fetchUpstream).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('storefront.store_api.upstream_failed'));
    errors.mockRestore();
  });

  it('sends CF-Connecting-IP as the client ip only when the edge is trusted', async () => {
    // Arrange
    const trusted = depsWith({ trustEdgeIp: () => true });
    const untrusted = depsWith();
    const headers = { 'cf-connecting-ip': '198.51.100.7' };
    const first = call('products', headers);
    const second = call('products', headers);
    // Act
    await handleStoreApiRequest(first.request, first.segments, trusted.deps);
    await handleStoreApiRequest(second.request, second.segments, untrusted.deps);
    // Assert
    expect(trusted.fetchUpstream.mock.calls[0]?.[1]).toEqual({ storeId: STORE_A.storeId, clientIp: '198.51.100.7' });
    expect(untrusted.fetchUpstream.mock.calls[0]?.[1]).toEqual({ storeId: STORE_A.storeId });
  });
});

describe('client ip of a store api call', () => {
  it('ignores CF-Connecting-IP unless the edge is trusted', () => {
    expect(clientIpOf(new Headers({ 'cf-connecting-ip': '198.51.100.7' }), false)).toBeUndefined();
  });

  it('never reads X-Forwarded-For, which any client can set', () => {
    expect(clientIpOf(new Headers({ 'x-forwarded-for': '198.51.100.7' }), true)).toBeUndefined();
  });

  it.each(['not-an-ip', '198.51.100.7, 10.0.0.1', ''])('refuses the malformed address %j', (value) => {
    expect(clientIpOf(new Headers({ 'cf-connecting-ip': value }), true)).toBeUndefined();
  });

  it('accepts an IPv6 address', () => {
    expect(clientIpOf(new Headers({ 'cf-connecting-ip': '2001:db8::1' }), true)).toBe('2001:db8::1');
  });
});

describe('buyer address the proxy hands the search page', () => {
  it('reads one valid address', () => {
    expect(buyerIpOfQuery({ [BUYER_IP_QUERY_PARAM]: '203.0.113.10' })).toBe('203.0.113.10');
    expect(buyerIpOfQuery({ [BUYER_IP_QUERY_PARAM]: ['2001:db8::1', '203.0.113.10'] })).toBe('2001:db8::1');
  });

  it.each([{}, { [BUYER_IP_QUERY_PARAM]: 'not-an-ip' }, { [BUYER_IP_QUERY_PARAM]: '' }])(
    'reads none from %j',
    (raw) => {
      expect(buyerIpOfQuery(raw)).toBeUndefined();
    },
  );
});
