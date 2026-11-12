import {
  INTERNAL_AUTH_HEADERS,
  INTERNAL_AUTH_MAX_SKEW_SECONDS,
  verifyInternalRequest,
  type InternalSigningKey,
} from '@cod/shared/internal-auth';
import type { RequestHandler, Request, Response } from 'express';

/** Who signed an accepted request, and the store, client address and country the signature covered. */
export interface InternalAuthContext {
  readonly kid: string;
  readonly storeId?: string;
  readonly clientIp?: string;
  readonly clientCountry?: string;
}

declare global {
  // Express's own extension point for request fields; a declaration merge is the only way to type `req.internalAuth`.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by the internal-only guard on a request whose signature verified. */
      internalAuth?: InternalAuthContext;
    }
  }
}

/** How {@link internalOnlyMiddleware} is configured. */
export interface InternalOnlyOptions {
  readonly keys: readonly InternalSigningKey[];
  /** The clock, in unix seconds; the system clock unless a test replaces it. */
  readonly nowSeconds?: () => number;
  readonly maxBodyBytes: number;
  /** Receives one line per rejected request: the reason, never a header value. */
  readonly log?: (message: string) => void;
}

const defaultNow = (): number => Math.floor(Date.now() / 1000);

/** A header's value; a repeated header is joined by Node, which fails the signature. */
function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value.join(',') : value;
}

/** How many times the body limit an oversized body may stream before the connection is dropped. */
const DRAIN_CEILING_FACTOR = 4;

/**
 * The body, or `undefined` when it is larger than `limit`. A body announced as too large is not read at all; one
 * that grows past the limit while streaming is drained without being kept, because leaving the loop would destroy
 * the socket and the 413 could be lost as a reset. The drain stops at {@link DRAIN_CEILING_FACTOR} times the limit,
 * where the stream is destroyed: a caller that never stops sending cannot hold the connection open.
 */
async function readBody(req: Request, limit: number): Promise<Buffer | undefined> {
  if (Number(header(req, 'content-length') ?? 0) > limit) {
    return undefined;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > limit) {
      tooLarge = true;
      chunks.length = 0;
    }
    if (size > limit * DRAIN_CEILING_FACTOR) {
      break;
    }
    if (!tooLarge) {
      chunks.push(buffer);
    }
  }
  return tooLarge ? undefined : Buffer.concat(chunks);
}

/** The parsed JSON body, `{}` when there is none to parse, or `undefined` when it is not valid JSON. */
function parseBody(req: Request, body: Buffer): unknown {
  const mediaType = (header(req, 'content-type') ?? '').split(';')[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json' || body.length === 0) {
    return {};
  }
  try {
    return JSON.parse(body.toString('utf8')) as unknown;
  } catch {
    return undefined;
  }
}

/** The store, client address and country the signature covers, as the receiver read them. */
function coveredFields(req: Request): Pick<InternalAuthContext, 'storeId' | 'clientIp' | 'clientCountry'> {
  const fields = {
    storeId: header(req, INTERNAL_AUTH_HEADERS.storeId),
    clientIp: header(req, INTERNAL_AUTH_HEADERS.clientIp),
    clientCountry: header(req, INTERNAL_AUTH_HEADERS.clientCountry),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

type Verdict =
  | { readonly ok: true; readonly auth: InternalAuthContext; readonly body: unknown }
  | { readonly ok: false; readonly status: 404 | 413; readonly reason: string };

const refuse = (reason: string, status: 404 | 413 = 404): Verdict => ({ ok: false, status, reason });

const TIMESTAMP = /^\d{1,12}$/;

/**
 * The cheap checks that need no body: all three headers present, a well-formed timestamp inside the clock window,
 * a known key id. Only a request that passes them has its body read, so a caller with no plausible header triple
 * cannot make the server buffer a body, nor earn a 413. These checks do not prove a signature: a caller who guesses
 * a key id and sends a current timestamp can still tell the path is guarded from a 413.
 */
function precheck(req: Request, keys: readonly InternalSigningKey[], nowSeconds: number): string | undefined {
  const kid = header(req, INTERNAL_AUTH_HEADERS.kid);
  const timestamp = header(req, INTERNAL_AUTH_HEADERS.timestamp);
  if (!kid || !timestamp || !header(req, INTERNAL_AUTH_HEADERS.signature)) {
    return 'missing';
  }
  if (!TIMESTAMP.test(timestamp)) {
    return 'malformed';
  }
  if (!keys.some((key) => key.kid === kid)) {
    return 'unknown-kid';
  }
  return Math.abs(nowSeconds - Number(timestamp)) > INTERNAL_AUTH_MAX_SKEW_SECONDS ? 'stale' : undefined;
}

async function judge(req: Request, options: InternalOnlyOptions, nowSeconds: number): Promise<Verdict> {
  // Refuse before reading a body nobody plausibly vouches for.
  const early = precheck(req, options.keys, nowSeconds);
  if (early !== undefined) {
    return refuse(early);
  }
  const body = await readBody(req, options.maxBodyBytes);
  if (body === undefined) {
    return refuse('body-too-large', 413);
  }
  const covered = coveredFields(req);
  const pathWithQuery = req.originalUrl || req.url;
  const result = verifyInternalRequest(
    { method: req.method, pathWithQuery, body, ...covered },
    req.headers as Record<string, string | undefined>,
    options.keys,
    nowSeconds,
  );
  if (!result.ok) {
    return refuse(result.reason);
  }
  const parsed = parseBody(req, body);
  return parsed === undefined
    ? refuse('malformed-json')
    : { ok: true, auth: { kid: result.kid, ...covered }, body: parsed };
}

/** Every refusal is an empty body, and 404 unless the body was too large, so a caller learns nothing about the route (D112). */
function respond(res: Response, status: number): void {
  res.statusCode = status;
  if (status === 413) {
    res.setHeader('connection', 'close');
  }
  res.end();
}

/**
 * Lets a request through only when it carries a valid internal signature (D111, D112). It reads the raw body
 * (413 above the limit), verifies the signature over `req.originalUrl` (Express strips the mount prefix from
 * `req.url`), sets `req.internalAuth`, and parses an `application/json` body into `req.body` for the route.
 * Every other outcome is 404 with an empty body; the reason is logged, never a header value.
 */
export function internalOnlyMiddleware(options: InternalOnlyOptions): RequestHandler {
  const now = options.nowSeconds ?? defaultNow;
  const log = options.log ?? ((): void => undefined);
  const logRefusal = (req: Request, reason: string): void => {
    log(`rejected ${req.method} ${(req.originalUrl || req.url).split('?')[0] ?? ''}: ${reason}`);
  };

  return (req, res, next) => {
    judge(req, options, now())
      .then((verdict) => {
        if (!verdict.ok) {
          logRefusal(req, verdict.reason);
          respond(res, verdict.status);
          return;
        }
        req.internalAuth = verdict.auth;
        req.body = verdict.body;
        // The stream is spent: tell the body parsers that follow (Nest's, Apollo's) to leave `req.body` alone.
        (req as Request & { _body?: boolean })._body = true;
        next();
      })
      .catch((error: unknown) => {
        logRefusal(req, error instanceof Error ? error.name : 'error');
        if (!res.headersSent) {
          respond(res, 404);
        }
      });
  };
}
