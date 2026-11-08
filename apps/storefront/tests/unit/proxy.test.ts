import { getRewrittenUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from '../../proxy';

/** A request as the storefront receives it: the URL's own host is irrelevant, only `Host` is read. */
function storefrontRequest(path: string, headers: Record<string, string>): NextRequest {
  return new NextRequest(new URL(path, 'http://127.0.0.1:3001'), { headers });
}

async function rewrittenPath(path: string, headers: Record<string, string>): Promise<string | null> {
  const rewritten = getRewrittenUrl(await proxy(storefrontRequest(path, headers)));
  return rewritten === null ? null : new URL(rewritten).pathname;
}

describe('storefront proxy', () => {
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

  it.each(['/api/store/cart', '/livez', '/readyz', '/_next/static/x.js'])('does not run on %s', (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(false);
  });

  it('runs on a storefront page', () => {
    expect(unstable_doesMiddlewareMatch({ config, url: '/p/shoe' })).toBe(true);
  });
});
