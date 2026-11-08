import { beforeAll, describe, expect, it } from 'vitest';
import { httpGetWithHost, STOREFRONT_URL, waitForHttp } from '../support/http-get-with-host';

const STARTUP_TIMEOUT_MS = 30_000;
const url = (path: string): string => new URL(path, STOREFRONT_URL).toString();

describe('storefront host routing (against next start)', () => {
  beforeAll(async () => {
    await waitForHttp(url('/livez'), 200, STARTUP_TIMEOUT_MS);
  });

  it('renders the demo store hello page', async () => {
    // Act
    const res = await httpGetWithHost(url('/'), 'demo.localhost');
    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toContain('data-testid="store-name"');
    expect(res.body).toContain('Demo Store');
  });

  it('renders a different store for the second host', async () => {
    const res = await httpGetWithHost(url('/'), 'second.localhost');
    expect(res.status).toBe(200);
    expect(res.body).toContain('Second Store');
  });

  it('returns the not-found page for an unknown host', async () => {
    const res = await httpGetWithHost(url('/'), 'nope.localhost');
    expect(res.status).toBe(404);
    expect(res.body).toContain('data-testid="not-found"');
  });

  it('returns 404 for a cross-tenant internal path', async () => {
    // Act: the demo host asks for the second store's internal path.
    const res = await httpGetWithHost(url('/_t/second/fr'), 'demo.localhost');
    // Assert
    expect(res.status).toBe(404);
    expect(res.body).not.toContain('Second Store');
  });

  it('ignores a spoofed X-Forwarded-Host', async () => {
    const res = await httpGetWithHost(url('/'), 'nope.localhost', { 'x-forwarded-host': 'demo.localhost' });
    expect(res.status).toBe(404);
    expect(res.body).not.toContain('Demo Store');
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
