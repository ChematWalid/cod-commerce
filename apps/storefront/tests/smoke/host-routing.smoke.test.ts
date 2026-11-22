import { beforeAll, describe, expect, it } from 'vitest';
import { httpGetWithHost, httpRequestWithHost, STOREFRONT_URL, waitForHttp } from '../support/http-get-with-host';
import { smokeBindingOf, type SmokeStore, smokeStoreOf } from '../support/smoke-api';

const STARTUP_TIMEOUT_MS = 30_000;
/** The start-up probe, then each demo store's wait for its projected products (`smokeStoreOf`). */
const SETUP_TIMEOUT_MS = 240_000;
/** The demo seed's stores (`pnpm --filter @cod/server seed:demo`). */
const demo = { name: 'Demo Store', primaryHost: 'demo.localhost' };
const second = { name: 'Second Store', primaryHost: 'second.localhost', defaultLocale: 'fr' };
/** What a tenant page tells Cloudflare to keep (ADR 0006 §4); browsers never read it. */
const CDN_HEADER = 'cloudflare-cdn-cache-control';
const TENANT_PAGE_CDN_CACHE_CONTROL = 'max-age=60, stale-while-revalidate=600';
const NOT_FOUND_MARKER = 'data-testid="not-found"';
/**
 * The forms of a tenant path a buyer may send: as written, `_` percent-encoded (the app folder's literal name), in
 * lower case, double-encoded, re-cased and behind a doubled slash. `tail` is `{locale}/{storeId}/{binding}` (D3202).
 */
const TENANT_PATH_VARIANTS: readonly (readonly [string, (tail: string) => string])[] = [
  ['as written', (tail) => `/_t/${tail}`],
  ['%5F', (tail) => `/%5Ft/${tail}`],
  ['%5f', (tail) => `/%5ft/${tail}`],
  ['%255F', (tail) => `/%255Ft/${tail}`],
  ['re-cased', (tail) => `/_T/${tail}`],
  ['doubled slash', (tail) => `//_t/${tail}`],
];
/** `url` as written: `new URL()` would read a path such as `//_t/…` as a host. */
const url = (path: string): string => `${STOREFRONT_URL.replace(/\/$/, '')}${path}`;

describe('storefront host routing (against next start)', () => {
  let demoStore: SmokeStore;
  let secondStore: SmokeStore;
  /**
   * The tail of the second store's tenant path, `{locale}/{storeId}/{binding}`, with the real binding of its own host.
   * The proxy refuses the `/_t` prefix from outside before the tenant layout's binding gate ever runs, so every form
   * answers the root 404 even though the binding itself is valid.
   */
  let secondTenantTail: string;

  beforeAll(async () => {
    await waitForHttp(url('/livez'), 200, STARTUP_TIMEOUT_MS);
    demoStore = await smokeStoreOf(demo.primaryHost);
    secondStore = await smokeStoreOf(second.primaryHost);
    secondTenantTail = `${second.defaultLocale}/${secondStore.storeId}/${smokeBindingOf(secondStore)}`;
  }, SETUP_TIMEOUT_MS);

  it('renders the demo store home page', async () => {
    // Act
    const res = await httpGetWithHost(url('/'), demo.primaryHost);
    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toContain('data-testid="store-name"');
    expect(res.body).toContain(demo.name);
    expect(res.body).not.toContain(second.name);
  });

  it('renders a different store for the second host', async () => {
    const res = await httpGetWithHost(url('/'), second.primaryHost);
    expect(res.status).toBe(200);
    expect(res.body).toContain(second.name);
    expect(res.body).not.toContain(demo.name);
  });

  it('marks a tenant page for the edge cache and sets no cookie', async () => {
    // Act
    const res = await httpGetWithHost(url('/products'), demo.primaryHost);
    // Assert
    expect(res.status).toBe(200);
    expect(res.headers[CDN_HEADER]).toBe(TENANT_PAGE_CDN_CACHE_CONTROL);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('returns the not-found page for an unknown host', async () => {
    const res = await httpGetWithHost(url('/'), 'nope.localhost');
    expect(res.status).toBe(404);
    expect(res.body).toContain(NOT_FOUND_MARKER);
  });

  it("answers the not-found page for the demo store's product slug on the second host", async () => {
    // Act
    const res = await httpGetWithHost(url(`/product/${encodeURIComponent(demoStore.productSlug)}`), second.primaryHost);
    // Assert: a soft 404 under Cache Components (D3202) or a real one, never the demo store's product.
    expect([200, 404]).toContain(res.status);
    expect(res.body).toContain(NOT_FOUND_MARKER);
    expect(res.body).not.toContain(demoStore.productName);
  });

  it("never answers the demo store's products to a search on the second host", async () => {
    // Arrange
    const term = demoStore.productName.split(' ')[0] ?? demoStore.productName;
    // Act
    const res = await httpGetWithHost(url(`/search?q=${encodeURIComponent(term)}`), second.primaryHost);
    // Assert
    expect(res.status).toBe(200);
    expect(demoStore.productNames.filter((name) => res.body.includes(name))).toEqual([]);
  });

  it.each(TENANT_PATH_VARIANTS)(
    "returns 404 for the second store's tenant path (%s) on the demo host",
    async (_form, pathOf) => {
      // Act: the demo host asks for the second store's tenant path.
      const res = await httpGetWithHost(url(pathOf(secondTenantTail)), demo.primaryHost);
      // Assert
      expect(res.status).toBe(404);
      expect(res.body).not.toContain(second.name);
      expect(secondStore.productNames.filter((name) => res.body.includes(name))).toEqual([]);
    },
  );

  it("answers the demo store's own products on /api/store, and 400 for another store's id", async () => {
    // Act
    const own = await httpGetWithHost(url('/api/store/products'), demo.primaryHost);
    const mismatch = await httpGetWithHost(url(`/api/store/products?storeId=${demoStore.storeId}`), second.primaryHost);
    // Assert
    expect(own.status).toBe(200);
    expect(own.body).toContain(demoStore.productName);
    expect(mismatch.status).toBe(400);
    expect(mismatch.body).toBe('');
  });

  it('refuses a dot-segment path on /api/store with an empty 404', async () => {
    const res = await httpGetWithHost(url('/api/store/product/..%2F..%2Fshop-api'), demo.primaryHost);
    expect(res.status).toBe(404);
    expect(res.body).toBe('');
  });

  it('refuses an unsigned revalidation with an empty 404', async () => {
    // Act
    const res = await httpRequestWithHost(url('/api/internal/revalidate'), demo.primaryHost, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tags: [`store:${demoStore.storeId}`] }),
    });
    // Assert
    expect(res.status).toBe(404);
    expect(res.body).toBe('');
  });

  it('ignores a spoofed X-Forwarded-Host', async () => {
    const res = await httpGetWithHost(url('/'), 'nope.localhost', { 'x-forwarded-host': demo.primaryHost });
    expect(res.status).toBe(404);
    expect(res.body).not.toContain(demo.name);
  });

  it('answers /livez for any host', async () => {
    const res = await httpGetWithHost(url('/livez'), '10.0.0.5:3001');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });

  it('answers /readyz 200', async () => {
    const res = await httpGetWithHost(url('/readyz'), 'nope.localhost');
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body) as { status: string; checks: { redis: { ok: unknown } } };
    expect(body.status).toBe('ready');
    expect(typeof body.checks.redis.ok).toBe('boolean');
  });
});
