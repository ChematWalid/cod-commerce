import { beforeAll, describe, expect, it } from 'vitest';
import { httpGetWithHost, STOREFRONT_URL, waitForHttp } from '../support/http-get-with-host';

const STARTUP_TIMEOUT_MS = 30_000;
/** The demo seed's stores (`pnpm --filter @cod/server seed:demo`). */
const demo = { name: 'Demo Store', primaryHost: 'demo.localhost' };
const second = { name: 'Second Store', primaryHost: 'second.localhost', defaultLocale: 'fr' };
const API_URL = process.env['INTERNAL_API_URL'] ?? 'http://localhost:3100';
const url = (path: string): string => new URL(path, STOREFRONT_URL).toString();

/** The second store's id, as the API knows it: its internal path needs a real id. */
async function secondStoreId(): Promise<string> {
  const response = await fetch(`${API_URL}/store/resolve?host=${second.primaryHost}`);
  if (!response.ok) throw new Error(`the demo seed has not run: ${String(response.status)}`);
  return ((await response.json()) as { storeId: string }).storeId;
}

describe('storefront host routing (against next start)', () => {
  /** The second store's internal route, which only a rewrite from its own host may reach. */
  let secondInternalPath: string;
  /** The same path with `_` percent-encoded (%5F), the literal name of the app folder. */
  let secondEncodedInternalPath: string;

  beforeAll(async () => {
    await waitForHttp(url('/livez'), 200, STARTUP_TIMEOUT_MS);
    const storeId = await secondStoreId();
    secondInternalPath = `/_t/${storeId}/${second.defaultLocale}`;
    secondEncodedInternalPath = `/%5Ft/${storeId}/${second.defaultLocale}`;
  });

  it('renders the demo store hello page', async () => {
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

  it('returns the not-found page for an unknown host', async () => {
    const res = await httpGetWithHost(url('/'), 'nope.localhost');
    expect(res.status).toBe(404);
    expect(res.body).toContain('data-testid="not-found"');
  });

  it('returns 404 for a cross-tenant internal path', async () => {
    // Act: the demo host asks for the second store's internal path.
    const res = await httpGetWithHost(url(secondInternalPath), demo.primaryHost);
    // Assert
    expect(res.status).toBe(404);
    expect(res.body).not.toContain(second.name);
  });

  it('returns 404 for the percent-encoded cross-tenant internal path', async () => {
    // Act: the encoded form must not slip past the proxy's guard on the internal prefix.
    const res = await httpGetWithHost(url(secondEncodedInternalPath), demo.primaryHost);
    // Assert
    expect(res.status).toBe(404);
    expect(res.body).not.toContain(second.name);
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
