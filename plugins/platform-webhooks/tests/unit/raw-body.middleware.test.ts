import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { brotliCompressSync, deflateSync, gzipSync } from 'node:zlib';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rawBodyMiddleware } from '../../infrastructure/raw-body.middleware';

const LIMIT = 1024;
const PAYLOAD = Buffer.from('{"event":"paid","secret":"hunter2"}');

describe('rawBodyMiddleware refusals and decoding', () => {
  const logged: string[] = [];
  const reached: Buffer[] = [];
  let server: Server;
  let url: string;

  beforeAll(async () => {
    const middleware = rawBodyMiddleware({ limit: LIMIT, log: (message) => logged.push(message) });
    server = createServer((req, res) => {
      middleware(req as Request, res as Response, () => {
        reached.push((req as Request).body as Buffer);
        res.statusCode = 200;
        res.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/webhooks/x/y`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const post = (body: Buffer, encoding?: string): Promise<globalThis.Response> =>
    fetch(url, {
      method: 'POST',
      body: new Uint8Array(body),
      headers: encoding === undefined ? {} : { 'content-encoding': encoding },
    });

  it('answers 415 for an encoding it does not decode and never reaches the handler', async () => {
    // Arrange
    reached.length = 0;
    logged.length = 0;

    // Act
    const response = await post(PAYLOAD, 'zstd');

    // Assert
    expect(response.status).toBe(415);
    expect(reached).toEqual([]);
    expect(logged).toEqual(['rejected POST /webhooks/x/y: unsupported-encoding']);
  });

  it.each([
    ['gzip', Buffer.from('not gzip at all')],
    ['deflate', Buffer.from('not deflate at all')],
    ['br', Buffer.from('not brotli at all')],
  ])('answers 400 for a %s body that does not decode, without storing the raw bytes', async (encoding, body) => {
    // Arrange
    reached.length = 0;
    logged.length = 0;

    // Act
    const response = await post(body, encoding);

    // Assert
    expect(response.status).toBe(400);
    expect(reached).toEqual([]);
    expect(logged).toEqual(['rejected POST /webhooks/x/y: bad-encoding']);
  });

  it.each([
    ['gzip', gzipSync(PAYLOAD)],
    ['deflate', deflateSync(PAYLOAD)],
    ['br', brotliCompressSync(PAYLOAD)],
    ['GZIP', gzipSync(PAYLOAD)],
  ])('hands the handler the inflated bytes of a valid %s body', async (encoding, body) => {
    // Arrange
    reached.length = 0;

    // Act
    const response = await post(body, encoding);

    // Assert
    expect(response.status).toBe(200);
    expect(reached).toHaveLength(1);
    expect(reached[0]?.equals(PAYLOAD)).toBe(true);
  });
});
