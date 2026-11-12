import { Readable } from 'node:stream';
import { signInternalRequest, type InternalRequest, type InternalSigningKey } from '@cod/shared/internal-auth';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { internalOnlyMiddleware } from '../../api/internal-only.middleware';

const KEY: InternalSigningKey = { kid: 'k1', secret: 'synthetic-internal-secret-0000000000000' };
const OTHER: InternalSigningKey = { kid: 'k2', secret: 'synthetic-other-secret-00000000000000' };
const NOW = 1_800_000_000;
const SIGNED: InternalRequest = {
  method: 'GET',
  pathWithQuery: '/store/resolve?host=demo.localhost',
  body: '',
  storeId: '77',
  clientIp: '203.0.113.9',
  clientCountry: 'DZ',
};

interface Harness {
  readonly req: Request;
  readonly res: Response & { statusCode: number };
  readonly next: ReturnType<typeof vi.fn>;
  readonly written: string[];
  readonly log: ReturnType<typeof vi.fn>;
  readonly run: () => Promise<void>;
}

/** The headers the receiver sees: the signature of `signed`, the store as `sent`, minus what `drop` removes. */
function requestHeaders(
  signed: InternalRequest,
  sent: InternalRequest,
  options: {
    key?: InternalSigningKey;
    at?: number;
    drop?: readonly string[];
    contentType?: string;
    headers?: Record<string, string>;
  },
): Record<string, string> {
  const all: Record<string, string> = {
    ...signInternalRequest(signed, options.key ?? KEY, options.at ?? NOW),
    ...options.headers,
    ...(options.contentType === undefined ? {} : { 'content-type': options.contentType }),
    ...(sent.storeId === undefined ? {} : { 'x-store-id': sent.storeId }),
    ...(sent.clientIp === undefined ? {} : { 'x-client-ip': sent.clientIp }),
    ...(sent.clientCountry === undefined ? {} : { 'x-client-country': sent.clientCountry }),
  };
  return Object.fromEntries(Object.entries(all).filter(([name]) => !(options.drop ?? []).includes(name)));
}

/** A fake request carrying `headers` and `body`, as the receiver sees it: the signature is over `signed`. */
function harness(
  signed: InternalRequest,
  options: {
    readonly sent?: Partial<InternalRequest>;
    readonly key?: InternalSigningKey;
    readonly at?: number;
    readonly keys?: readonly InternalSigningKey[];
    readonly drop?: readonly string[];
    readonly contentType?: string;
    readonly maxBodyBytes?: number;
    readonly headers?: Record<string, string>;
    /** Send the body in pieces of this many bytes, as a chunked upload with no Content-Length arrives. */
    readonly chunkBytes?: number;
  } = {},
): Harness {
  const sent = { ...signed, ...options.sent };
  const headers = requestHeaders(signed, sent, options);
  const body = Buffer.from(sent.body);
  const pieces: Buffer[] = [];
  for (let at = 0; at < body.length; at += options.chunkBytes ?? body.length) {
    pieces.push(body.subarray(at, at + (options.chunkBytes ?? body.length)));
  }
  const req = Object.assign(Readable.from(pieces), {
    method: sent.method,
    originalUrl: sent.pathWithQuery,
    url: sent.pathWithQuery.replace(/^\/[^/?]*/, '') || '/',
    headers,
  }) as unknown as Request;
  const written: string[] = [];
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader: vi.fn(),
    end: vi.fn((chunk?: string) => {
      if (chunk !== undefined) written.push(chunk);
    }),
  } as unknown as Response & { statusCode: number };
  const next = vi.fn();
  const log = vi.fn();
  const middleware = internalOnlyMiddleware({
    keys: options.keys ?? [KEY],
    nowSeconds: () => NOW,
    maxBodyBytes: options.maxBodyBytes ?? 1024,
    log,
  });
  const run = (): Promise<void> =>
    new Promise((resolve) => {
      const done = (): void => {
        resolve();
      };
      (res.end as ReturnType<typeof vi.fn>).mockImplementation((chunk?: string) => {
        if (chunk !== undefined) written.push(chunk);
        done();
      });
      next.mockImplementation(done);
      middleware(req, res, next);
    });
  return { req, res, next, written, log, run };
}

async function expectRejected(h: Harness, reason: string, status = 404): Promise<void> {
  await h.run();
  expect(h.res.statusCode).toBe(status);
  expect(h.written).toEqual([]);
  expect(h.next).not.toHaveBeenCalled();
  expect(h.log).toHaveBeenCalledTimes(1);
  expect(String(h.log.mock.calls[0]?.[0])).toContain(reason);
}

describe('internalOnlyMiddleware', () => {
  it('passes a signed request and records who signed it', async () => {
    const h = harness(SIGNED);

    await h.run();

    expect(h.next).toHaveBeenCalledTimes(1);
    expect(h.res.statusCode).toBe(200);
    expect(h.req.internalAuth).toEqual({ kid: 'k1', storeId: '77', clientIp: '203.0.113.9', clientCountry: 'DZ' });
  });

  it('parses a signed JSON body into req.body', async () => {
    const body = JSON.stringify({ query: '{ activeChannel { code } }' });
    const h = harness(
      { ...SIGNED, method: 'POST', pathWithQuery: '/shop-api', body },
      { contentType: 'application/json; charset=utf-8' },
    );

    await h.run();

    expect(h.next).toHaveBeenCalledTimes(1);
    expect(h.req.body).toEqual({ query: '{ activeChannel { code } }' });
  });

  it('accepts a key other than the first and a skew of exactly 60 seconds', async () => {
    const h = harness(SIGNED, { key: OTHER, keys: [KEY, OTHER], at: NOW - 60 });

    await h.run();

    expect(h.next).toHaveBeenCalledTimes(1);
    expect(h.req.internalAuth?.kid).toBe('k2');
  });

  it('accepts a skew of exactly +60 seconds', async () => {
    const h = harness(SIGNED, { at: NOW + 60 });

    await h.run();

    expect(h.next).toHaveBeenCalledTimes(1);
  });

  it('answers 404 with an empty body, logs once and never calls next for each tamper', async () => {
    const cases: [string, Harness, string][] = [
      ['method', harness(SIGNED, { sent: { method: 'POST' } }), 'bad-signature'],
      ['path', harness(SIGNED, { sent: { pathWithQuery: '/store/resolve/?host=demo.localhost' } }), 'bad-signature'],
      ['query', harness(SIGNED, { sent: { pathWithQuery: '/store/resolve?host=evil.example' } }), 'bad-signature'],
      ['store id', harness(SIGNED, { sent: { storeId: '78' } }), 'bad-signature'],
      ['client ip', harness(SIGNED, { sent: { clientIp: '203.0.113.10' } }), 'bad-signature'],
      ['client country', harness(SIGNED, { sent: { clientCountry: 'FR' } }), 'bad-signature'],
      ['body', harness({ ...SIGNED, method: 'POST', body: 'a' }, { sent: { body: 'b' } }), 'bad-signature'],
      ['stale', harness(SIGNED, { at: NOW - 61 }), 'stale'],
      ['future', harness(SIGNED, { at: NOW + 61 }), 'stale'],
      ['unknown kid', harness(SIGNED, { key: OTHER }), 'unknown-kid'],
      ['missing signature', harness(SIGNED, { drop: ['x-internal-sig'] }), 'missing'],
      ['missing kid', harness(SIGNED, { drop: ['x-internal-kid'] }), 'missing'],
      ['malformed timestamp', harness(SIGNED, { headers: { 'x-internal-ts': 'soon' } }), 'malformed'],
    ];
    for (const [, h, reason] of cases) {
      await expectRejected(h, reason);
    }
  });

  it('answers 404 to a request with no internal headers at all', async () => {
    const h = harness(SIGNED, { drop: ['x-internal-kid', 'x-internal-ts', 'x-internal-sig'] });

    await expectRejected(h, 'missing');
  });

  it('refuses everything when no key is configured', async () => {
    await expectRejected(harness(SIGNED, { keys: [] }), 'unknown-kid');
  });

  it('answers 413 above the body limit, with an empty body and without calling next', async () => {
    const body = 'x'.repeat(2000);

    await expectRejected(harness({ ...SIGNED, method: 'POST', body }, { maxBodyBytes: 1024 }), 'body-too-large', 413);
  });

  it('answers 413 to a chunked body over the limit and reads the stream to its end, so the answer is not cut off', async () => {
    const h = harness({ ...SIGNED, method: 'POST', body: 'x'.repeat(4000) }, { maxBodyBytes: 1024, chunkBytes: 500 });

    await expectRejected(h, 'body-too-large', 413);
    await vi.waitFor(() => {
      expect(h.req.readableEnded).toBe(true);
    });
  });

  it('stops reading and destroys the stream once an oversized chunked body passes four times the limit', async () => {
    const h = harness({ ...SIGNED, method: 'POST', body: 'x'.repeat(20000) }, { maxBodyBytes: 1024, chunkBytes: 500 });

    await expectRejected(h, 'body-too-large', 413);
    await vi.waitFor(() => {
      expect(h.req.destroyed).toBe(true);
    });
    expect(h.req.readableEnded).toBe(false);
  });

  it.each([
    ['an unknown key id', { 'x-internal-kid': 'nobody' }, 'unknown-kid'],
    ['a malformed timestamp', { 'x-internal-ts': 'soon' }, 'malformed'],
    ['a stale timestamp', { 'x-internal-ts': String(NOW - 3600) }, 'stale'],
  ])('answers 404, not 413, to %s even with a body over the limit', async (_name, headers, reason) => {
    const h = harness(SIGNED, { headers: { ...headers, 'content-length': '999999' } });

    await expectRejected(h, reason);
    expect(h.req.readableFlowing).toBeNull();
  });

  it('answers 404 to a signed body that is not valid JSON under a JSON content type', async () => {
    const h = harness({ ...SIGNED, method: 'POST', body: '{nope' }, { contentType: 'application/json' });

    await expectRejected(h, 'malformed-json');
  });

  it.each([
    ['a tampered store id', harness(SIGNED, { sent: { storeId: '78' } }), 'bad-signature'],
    ['a stale timestamp', harness(SIGNED, { at: NOW - 3600 }), 'stale'],
  ])('logs the reason and the path, never a header value or the query (%s)', async (_name, h, reason) => {
    await h.run();

    const line = String(h.log.mock.calls[0]?.[0]);
    expect(line).toContain(reason);
    expect(line).toContain('/store/resolve');
    expect(line).not.toContain('host=demo.localhost');
    for (const value of Object.values(h.req.headers as Record<string, string>)) {
      expect(line).not.toContain(value);
    }
  });
});
