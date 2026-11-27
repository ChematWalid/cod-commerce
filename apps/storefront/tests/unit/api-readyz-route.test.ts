import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));

/** A stand-in for the node-local api: answers /readyz with whatever status the test sets. */
const stubApi = { status: 200, delayMs: 0 };
let server: Server;

beforeAll(async () => {
  server = createServer((request, response) => {
    setTimeout(() => {
      response.statusCode = request.url === '/readyz' ? stubApi.status : 404;
      response.setHeader('content-type', 'application/json');
      response.end('{"status":"x","checks":{"postgres":{"ok":false,"error":"db-primary.internal:5432"}}}');
    }, stubApi.delayMs);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  vi.stubEnv('INTERNAL_API_URL', `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`);
});

afterAll(async () => {
  vi.unstubAllEnvs();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => { resolve(); }));
});

beforeEach(() => {
  stubApi.status = 200;
  stubApi.delayMs = 0;
});

describe('GET /api/readyz against a stub api over HTTP', () => {
  it('answers 200, uncached, while the api is ready', async () => {
    // Arrange
    const { GET } = await import('../../app/api/readyz/route');
    // Act
    const response = await GET();
    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ status: 'ready', checks: { api: { ok: true } } });
  });

  it('answers 503 while the api drains, without repeating its body', async () => {
    // Arrange
    stubApi.status = 503;
    const { GET } = await import('../../app/api/readyz/route');
    // Act
    const response = await GET();
    const text = await response.text();
    // Assert
    expect(response.status).toBe(503);
    expect(text).not.toContain('db-primary');
  });

  it('answers 503 when the api is slower than 300 ms', async () => {
    // Arrange
    stubApi.delayMs = 600;
    const { GET } = await import('../../app/api/readyz/route');
    // Act
    const response = await GET();
    // Assert
    expect(response.status).toBe(503);
  });
});
