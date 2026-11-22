import { getRewrittenUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { normalizeHost, type NormalizedHost } from '@cod/shared';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config, proxy } from '../../proxy';
import { hostBindingOf } from '../../src/tenancy/host-binding';

const SIGNING_KEY = { kid: 'k1', secret: 'change-me-internal-hmac-000000000000000000000' };

/** The binding the proxy must put in the tenant path of `storeId` on its primary host. */
function bindingOf(storeId: string, host: string): string {
  return hostBindingOf(SIGNING_KEY, storeId, normalizeHost(host) as NormalizedHost);
}

const DEMO_BINDING = bindingOf('demo', 'demo.localhost');
const SECOND_BINDING = bindingOf('second', 'second.localhost');
const CDN_CACHE_HEADER = 'cloudflare-cdn-cache-control';

/** The stores the fake API knows, by host. */
const STORES: Record<string, object> = {
  'demo.localhost': store('demo', 'ar', 'demo.localhost'),
  'second.localhost': store('second', 'fr', 'second.localhost'),
  'shop.localhost': store('demo', 'ar', 'demo.localhost'),
};

function store(storeId: string, language: string, primaryHost: string): object {
  return {
    storeId,
    businessId: `business-${storeId}`,
    language,
    name: storeId,
    logo: null,
    primaryHost,
    status: 'active',
  };
}

function fakeApi(input: URL): Promise<Response> {
  const host = input.searchParams.get('host') ?? '';
  const known = STORES[host];
  return Promise.resolve(known ? Response.json(known) : new Response('{}', { status: 404 }));
}

/** A request as the storefront receives it: the URL's own host is irrelevant, only `Host` is read. */
function storefrontRequest(path: string, headers: Record<string, string>): NextRequest {
  // Concatenated, not resolved: `new URL('//_t/x', base)` would read `_t` as a host.
  return new NextRequest(`http://127.0.0.1:3001${path}`, { headers });
}

async function rewrittenPath(path: string, headers: Record<string, string>): Promise<string | null> {
  const rewritten = getRewrittenUrl(await proxy(storefrontRequest(path, headers)));
  return rewritten === null ? null : new URL(rewritten).pathname;
}

describe('storefront proxy', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_API_URL', 'http://api.test:3000');
    vi.stubEnv('INTERNAL_HMAC_KEYS', 'k1:change-me-internal-hmac-000000000000000000000');
    vi.stubEnv('INTERNAL_HMAC_ACTIVE_KID', 'k1');
    vi.stubGlobal('fetch', vi.fn(fakeApi));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rewrites a known host to the tenant path: locale, store, host binding, then the path', async () => {
    // Arrange
    const headers = { host: 'demo.localhost:3001' };
    // Act
    const path = await rewrittenPath('/p/shoe', headers);
    // Assert
    expect(path).toBe(`/_t/ar/demo/${DEMO_BINDING}/p/shoe`);
  });

  it('rewrites the root of a known host without a trailing slash', async () => {
    await expect(rewrittenPath('/', { host: 'second.localhost' })).resolves.toBe(`/_t/fr/second/${SECOND_BINDING}`);
  });

  it('puts the language of a French store in the tenant path, never the buyer Accept-Language', async () => {
    // Arrange
    const headers = { host: 'second.localhost', 'accept-language': 'ar-DZ,ar;q=0.9' };
    // Act
    const path = await rewrittenPath('/products', headers);
    // Assert
    expect(path).toBe(`/_t/fr/second/${SECOND_BINDING}/products`);
  });

  it('lets the CDN cache a tenant page for a minute and sets no cookie', async () => {
    // Act
    const response = await proxy(storefrontRequest('/products', { host: 'demo.localhost' }));
    // Assert
    expect(response.headers.get(CDN_CACHE_HEADER)).toBe('max-age=60, stale-while-revalidate=600');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it.each(['/search', '/search/', '/search?q=shoe'])('keeps the search page %s out of the CDN', async (path) => {
    // Act
    const response = await proxy(storefrontRequest(path, { host: 'demo.localhost' }));
    // Assert
    expect(response.headers.get(CDN_CACHE_HEADER)).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('sends an unknown host to the not-found page', async () => {
    await expect(rewrittenPath('/', { host: 'nope.localhost' })).resolves.toBe('/_404');
  });

  it('sends a host outside the platform domain to the not-found page without asking the api', async () => {
    // Arrange
    const fetchMock = vi.fn(fakeApi);
    vi.stubGlobal('fetch', fetchMock);
    // Act
    const path = await rewrittenPath('/', { host: 'x.example.com' });
    // Assert
    expect(path).toBe('/_404');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    `/_t/fr/second/${SECOND_BINDING}`,
    `/%5Ft/fr/second/${SECOND_BINDING}`,
    '/%5ft/fr/second',
    '/%255Ft/fr/second',
    '/%255f404',
    '/%25255Ft/fr',
    '/_T/fr/second',
    '//_t/fr/second',
    '/_404',
    '/_internal/revalidate',
    '/_INTERNAL',
    '/api/internal/revalidate',
    '/API/Internal/revalidate',
    '/%61pi/internal/revalidate',
    '/%E0%A4%A',
    '/%',
  ])('sends the public internal or malformed path %s to the not-found page', async (internalPath) => {
    await expect(rewrittenPath(internalPath, { host: 'demo.localhost' })).resolves.toBe('/_404');
  });

  it('ignores x-forwarded-host', async () => {
    // Arrange: the Host is unknown; only the spoofable header names a real store.
    const headers = { host: 'nope.localhost', 'x-forwarded-host': 'demo.localhost' };
    // Act
    const path = await rewrittenPath('/', headers);
    // Assert
    expect(path).toBe('/_404');
  });

  it('normalises an uppercase host with a port and a trailing dot', async () => {
    await expect(rewrittenPath('/', { host: 'DEMO.localhost.:3001' })).resolves.toBe(`/_t/ar/demo/${DEMO_BINDING}`);
  });

  it('sends a secondary host to the primary host with a 301, keeping path, query and port', async () => {
    // Arrange
    const request = storefrontRequest('/p/shoe?ref=ad', { host: 'shop.localhost:3001' });

    // Act
    const response = await proxy(request);

    // Assert
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('http://demo.localhost:3001/p/shoe?ref=ad');
  });

  it('redirects to https when the edge terminated TLS, without inventing a port', async () => {
    // Arrange
    const request = storefrontRequest('/', { host: 'shop.localhost', 'x-forwarded-proto': 'https' });

    // Act
    const response = await proxy(request);

    // Assert
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://demo.localhost/');
  });

  it('fails the request instead of showing a 404 when the API is down', async () => {
    // Arrange: a host no other test resolved, so the in-process store cache cannot answer for the API.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('connection refused'))),
    );

    // Act and Assert
    await expect(proxy(storefrontRequest('/', { host: 'outage.localhost' }))).rejects.toThrow('connection refused');
  });

  it.each(['/api/store/cart', '/livez', '/readyz', '/favicon.ico', '/_next/static/x.js', '/_next/image'])(
    'does not run on %s',
    (path) => {
      expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(false);
    },
  );

  it.each(['/p/shoe', '/livez-sale', '/readyz-x', '/favicon.icox', '/apiary'])(
    'runs on the storefront page %s',
    (path) => {
      expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(true);
    },
  );
});
