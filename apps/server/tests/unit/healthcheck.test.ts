import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { HealthcheckConfigError, healthcheckUrl, isReady } from '../../src/healthcheck';

const SHORT_TIMEOUT_MS = 200;

/** A local server that answers every request with `status`, or never answers when `status` is undefined. */
async function serve(status: number | undefined): Promise<{ server: Server; url: string }> {
  const server = createServer((_request, response) => {
    if (status !== undefined) {
      response.statusCode = status;
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${String(port)}/readyz` };
}

describe('healthcheckUrl', () => {
  it('targets the api port for the api role', () => {
    expect(healthcheckUrl({ ROLE: 'api', API_PORT: '3100' })).toBe('http://127.0.0.1:3100/readyz');
  });

  it('targets the worker health port for the worker role', () => {
    expect(healthcheckUrl({ ROLE: 'worker', WORKER_HEALTH_PORT: '3021' })).toBe('http://127.0.0.1:3021/readyz');
  });

  it('falls back to the default ports', () => {
    expect(healthcheckUrl({ ROLE: 'api' })).toBe('http://127.0.0.1:3000/readyz');
    expect(healthcheckUrl({ ROLE: 'worker', WORKER_HEALTH_PORT: '' })).toBe('http://127.0.0.1:3020/readyz');
  });

  it('rejects the migrate role and a bad port', () => {
    expect(() => healthcheckUrl({ ROLE: 'migrate' })).toThrow(HealthcheckConfigError);
    expect(() => healthcheckUrl({ ROLE: 'api', API_PORT: 'http' })).toThrow('API_PORT is not a port');
  });
});

describe('isReady', () => {
  let server: Server | undefined;

  afterEach(async () => {
    server?.closeAllConnections();
    await new Promise<void>((resolve) => {
      if (server === undefined) {
        resolve();
        return;
      }
      server.close(() => {
        resolve();
      });
    });
    server = undefined;
  });

  it('is true when readyz answers 200', async () => {
    const target = await serve(200);
    server = target.server;

    expect(await isReady(target.url, SHORT_TIMEOUT_MS)).toBe(true);
  });

  it('is false when readyz answers 503', async () => {
    const target = await serve(503);
    server = target.server;

    expect(await isReady(target.url, SHORT_TIMEOUT_MS)).toBe(false);
  });

  it('is false when readyz does not answer in time', async () => {
    const target = await serve(undefined);
    server = target.server;

    expect(await isReady(target.url, SHORT_TIMEOUT_MS)).toBe(false);
  });

  it('is false when nothing listens', async () => {
    expect(await isReady('http://127.0.0.1:1/readyz', SHORT_TIMEOUT_MS)).toBe(false);
  });
});
