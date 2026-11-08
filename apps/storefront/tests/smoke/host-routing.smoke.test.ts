import { beforeAll, describe, expect, it } from 'vitest';
import { STUB_STORES } from '../../src/tenancy/stub-store-resolver';
import { httpGetWithHost, STOREFRONT_URL, waitForHttp } from '../support/http-get-with-host';

const STARTUP_TIMEOUT_MS = 30_000;
const [demo, second] = STUB_STORES;
if (!demo || !second) throw new Error('the smoke tests need the two stub stores');
/** The second store's internal route, which only a rewrite from its own host may reach. */
const secondInternalPath = `/_t/${second.storeId}/${second.defaultLocale}`;
/** The same path with `_` percent-encoded (%5F), the literal name of the app folder. */
const secondEncodedInternalPath = `/%5Ft/${second.storeId}/${second.defaultLocale}`;
const url = (path: string): string => new URL(path, STOREFRONT_URL).toString();

describe('storefront host routing (against next start)', () => {
  beforeAll(async () => {
    await waitForHttp(url('/livez'), 200, STARTUP_TIMEOUT_MS);
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
