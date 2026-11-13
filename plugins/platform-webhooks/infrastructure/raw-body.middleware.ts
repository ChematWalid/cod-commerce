import { promisify } from 'node:util';
import { brotliDecompress, gunzip, inflate } from 'node:zlib';
import type { Request, RequestHandler, Response } from 'express';

type Decoder = (input: Buffer, options: { maxOutputLength: number }) => Promise<Buffer>;

const DECODERS: Readonly<Record<string, Decoder>> = {
  gzip: promisify(gunzip),
  deflate: promisify(inflate),
  br: promisify(brotliDecompress),
};

/** A compressed body may be this many times the limit on the wire; what counts is its size once inflated. */
const COMPRESSED_FACTOR = 2;

/** How many times its ceiling a body may stream before the connection is dropped. */
const DRAIN_CEILING_FACTOR = 4;

const ERR_BUFFER_TOO_LARGE = 'ERR_BUFFER_TOO_LARGE';

/** How {@link rawBodyMiddleware} is configured. */
export interface RawBodyOptions {
  /** The most bytes of body, after decompression. */
  readonly limit: number;
  /** Receives one line per refused request: the reason, never a header or body value. */
  readonly log?: (message: string) => void;
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value.join(',') : value;
}

/**
 * The body, or `undefined` when it is larger than `ceiling`. A body announced as too large is not read; one that
 * grows past the ceiling while streaming is drained without being kept, because leaving the loop would destroy the
 * socket and the 413 could be lost as a reset. The drain stops at {@link DRAIN_CEILING_FACTOR} times the ceiling.
 */
async function readBody(req: Request, ceiling: number): Promise<Buffer | undefined> {
  if (Number(header(req, 'content-length') ?? 0) > ceiling) return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > ceiling) {
      tooLarge = true;
      chunks.length = 0;
    }
    if (size > ceiling * DRAIN_CEILING_FACTOR) break;
    if (!tooLarge) chunks.push(buffer);
  }
  return tooLarge ? undefined : Buffer.concat(chunks);
}

function refuse(res: Response, status: 413 | 415 | 400): void {
  res.statusCode = status;
  if (status === 413) res.setHeader('connection', 'close');
  res.end();
}

/** The decoded body, `undefined` when it inflates past the limit, or `null` when the encoding is not valid. */
async function decode(body: Buffer, encoding: string, limit: number): Promise<Buffer | undefined | null> {
  const decoder = DECODERS[encoding];
  if (decoder === undefined) return body;
  try {
    return await decoder(body, { maxOutputLength: limit });
  } catch (error: unknown) {
    return (error as { code?: string }).code === ERR_BUFFER_TOO_LARGE ? undefined : null;
  }
}

/**
 * Keeps the exact bytes of a webhook body in `req.body` (D109), because a provider signs the bytes and a parsed body
 * cannot reproduce them. More than `limit` bytes, counted after decompression, answers 413 and nothing is stored; an
 * encoding other than identity, gzip, deflate or br answers 415. It marks the stream as read so Nest's own parsers,
 * which run later, leave `req.body` alone.
 */
export function rawBodyMiddleware(options: RawBodyOptions): RequestHandler {
  const log = options.log ?? ((): void => undefined);
  const refusal = (req: Request, res: Response, status: 413 | 415 | 400, reason: string): void => {
    log(`rejected ${req.method} ${(req.originalUrl || req.url).split('?')[0] ?? ''}: ${reason}`);
    refuse(res, status);
  };

  return (req, res, next) => {
    const encoding = (header(req, 'content-encoding') ?? 'identity').trim().toLowerCase();
    const compressed = DECODERS[encoding] !== undefined;
    if (!compressed && encoding !== 'identity') {
      refusal(req, res, 415, 'unsupported-encoding');
      return;
    }
    readBody(req, compressed ? options.limit * COMPRESSED_FACTOR : options.limit)
      .then(async (wire) => {
        const body = wire === undefined ? undefined : await decode(wire, encoding, options.limit);
        if (body === undefined) {
          refusal(req, res, 413, 'body-too-large');
          return;
        }
        if (body === null) {
          refusal(req, res, 400, 'bad-encoding');
          return;
        }
        req.body = body;
        (req as Request & { _body?: boolean })._body = true;
        next();
      })
      .catch((error: unknown) => {
        log(`rejected ${req.method}: ${error instanceof Error ? error.name : 'error'}`);
        if (!res.headersSent) refuse(res, 400);
      });
  };
}
