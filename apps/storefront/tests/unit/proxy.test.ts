import { getRewrittenUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config, proxy } from '../../proxy';

/** The stores the fake API knows, by host. */
const STORES: Record<string, object> = {
  'demo.localhost': store('demo', 'ar', 'demo.localhost'),
  'second.localhost': store('second', 'fr', 'second.localhost'),
  'shop.example.test': store('demo', 'ar', 'demo.localhost'),
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
  return new NextRequest(new URL(path, 'http://127.0.0.1:3001'), { headers });
}

async function rewrittenPath(path: string, headers: Record<string, string>): Promise<string | null> {
  const rewritten = getRewrittenUrl(await proxy(storefrontRequest(path, headers)));
  return rewritten === null ? null : new URL(rewritten).pathname;
}

describe('storefront proxy', () => {
  beforeEach(() => {
    vi.stubEnv('INTERNAL_API_URL', 'http://api.test:3000');
    vi.stubGlobal('fetch', vi.fn(fakeApi));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rewrites a known host to the tenant path with the default locale', async () => {
    // Arrange
    const headers = { host: 'demo.localhost:3001' };
    // Act
    const path = await rewrittenPath('/p/shoe', headers);
    // Assert
    expect(path).toBe('/_t/demo/ar/p/shoe');
  });

  it('rewrites the root of a known host without a trailing slash', async () => {
    await expect(rewrittenPath('/', { host: 'second.localhost' })).resolves.toBe('/_t/second/fr');
  });

  it('sends an unknown host to the not-found page', async () => {
    await expect(rewrittenPath('/', { host: 'nope.localhost' })).resolves.toBe('/_404');
  });

  it.each(['/_t/second/fr', '/%5Ft/second/fr', '/%5ft/second', '/_404', '/_internal/revalidate'])(
    'sends the public internal path %s to the not-found page',
    async (internalPath) => {
      await expect(rewrittenPath(internalPath, { host: 'demo.localhost' })).resolves.toBe('/_404');
    },
  );

  it('ignores x-forwarded-host', async () => {
    // Arrange: the Host is unknown; only the spoofable header names a real store.
    const headers = { host: 'nope.localhost', 'x-forwarded-host': 'demo.localhost' };
    // Act
    const path = await rewrittenPath('/', headers);
    // Assert
    expect(path).toBe('/_404');
  });

  it('normalises an uppercase host with a port and a trailing dot', async () => {
    await expect(rewrittenPath('/', { host: 'DEMO.localhost.:3001' })).resolves.toBe('/_t/demo/ar');
  });

  it('sends a secondary host to the primary host with a 301, keeping path, query and port', async () => {
    // Arrange
    const request = storefrontRequest('/p/shoe?ref=ad', { host: 'shop.example.test:3001' });

    // Act
    const response = await proxy(request);

    // Assert
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('http://demo.localhost:3001/p/shoe?ref=ad');
  });

  it('redirects to https when the edge terminated TLS, without inventing a port', async () => {
    // Arrange
    const request = storefrontRequest('/', { host: 'shop.example.test', 'x-forwarded-proto': 'https' });

    // Act
    const response = await proxy(request);

    // Assert
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://demo.localhost/');
  });

  it('fails the request instead of showing a 404 when the API is down', async () => {
    // Arrange
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('connection refused'))),
    );

    // Act and Assert
    await expect(proxy(storefrontRequest('/', { host: 'demo.localhost' }))).rejects.toThrow('connection refused');
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
