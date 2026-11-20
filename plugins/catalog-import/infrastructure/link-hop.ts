import { type ClientRequest, type IncomingMessage, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { LinkRefusedError, LinkUnreachableError } from '../domain/errors';
import type { VettedLink } from '../domain/ssrf';

/** Every address a host name resolves to, each already vetted public (D2214); refusing rejects. */
export interface AddressSource {
  addressesOf(hostname: string): Promise<readonly string[]>;
}

/** What one request answered: a page's first bytes, or where a redirect points. */
export type HopResult =
  { readonly kind: 'page'; readonly html: string } | { readonly kind: 'redirect'; readonly location: string };

/** What a hop is doing, so a timeout knows whether it hit DNS (refused) or a vetted server (unreachable). */
export type HopPhase = 'resolving' | 'connected';

/** One request's settings and the fetch it belongs to. */
export interface HopSettings {
  readonly addresses: AddressSource;
  readonly maxBytes: number;
  /** Told the request, so the fetch can destroy it on timeout, and each phase change. */
  readonly track: (request: ClientRequest) => void;
  readonly phase: (phase: HopPhase) => void;
}

const REDIRECT_STATUSES: ReadonlySet<number> = new Set([301, 302, 303, 307, 308]);
const HTML_TYPE = /^\s*text\/html\s*(;|$)/i;
const OK_MIN = 200;
const OK_MAX = 299;
/** A generic client name: nothing about the platform, a store or the merchant (privacy). */
const USER_AGENT = 'Mozilla/5.0 (compatible; product-link-import/1.0)';

type LookupCallback = Parameters<LookupFunction>[2];

/**
 * The `lookup` of every connection of a hop (D2214): Node calls it for each new socket of a name (an address literal
 * was classified before), so a rebinding name and every redirect hop are vetted again. Any failure is a refusal.
 */
function vettedLookup(settings: HopSettings): LookupFunction {
  return (hostname, options, callback: LookupCallback) => {
    settings.phase('resolving');
    const refuse = (): void => {
      callback(new LinkRefusedError(), '', 0);
    };
    settings.addresses.addressesOf(hostname).then((addresses) => {
      const entries = addresses.map((address) => ({ address, family: isIP(address) }));
      const [first] = entries;
      if (first === undefined) {
        refuse();
        return;
      }
      settings.phase('connected');
      // `all` is how Node's happy-eyeballs connect asks; a plain lookup wants one address.
      if (options.all === true) (callback as (error: null, all: typeof entries) => void)(null, entries);
      else callback(null, first.address, first.family);
    }, refuse);
  };
}

/** Reads at most `maxBytes` of a 2xx HTML answer, then stops receiving. */
function readPage(response: IncomingMessage, settings: HopSettings, request: ClientRequest): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;
    const done = (): void => {
      resolve({ kind: 'page', html: Buffer.concat(chunks).toString('utf8') });
    };
    response.on('data', (chunk: Buffer) => {
      const room = settings.maxBytes - received;
      chunks.push(chunk.subarray(0, room));
      received += Math.min(chunk.length, room);
      if (received < settings.maxBytes) return;
      done();
      request.destroy();
    });
    response.on('end', done);
    response.on('error', () => {
      reject(new LinkUnreachableError());
    });
  });
}

/** What a hop answers for one response: follow a redirect, read a page, or refuse. */
function answerOf(response: IncomingMessage, settings: HopSettings, request: ClientRequest): Promise<HopResult> {
  const status = response.statusCode ?? 0;
  const { location } = response.headers;
  if (REDIRECT_STATUSES.has(status) && location !== undefined) {
    request.destroy();
    return Promise.resolve({ kind: 'redirect', location });
  }
  if (status < OK_MIN || status > OK_MAX) {
    request.destroy();
    return Promise.reject(new LinkUnreachableError());
  }
  if (!HTML_TYPE.test(response.headers['content-type'] ?? '')) {
    request.destroy();
    return Promise.reject(new LinkRefusedError());
  }
  return readPage(response, settings, request);
}

/**
 * One GET of a vetted link (D2214): its own socket (`agent: false`, so no proxy agent and no keep-alive reuse), the
 * vetted lookup for a name, `accept-encoding: identity`. A failure answers a fixed error, never the library's.
 */
export function fetchHop(link: VettedLink, settings: HopSettings): Promise<HopResult> {
  return new Promise((resolve, reject) => {
    const send = link.url.protocol === 'https:' ? httpsRequest : httpRequest;
    settings.phase(link.isIpLiteral ? 'connected' : 'resolving');
    const request = send({
      hostname: link.hostname,
      port: link.port,
      path: `${link.url.pathname}${link.url.search}`,
      method: 'GET',
      agent: false,
      headers: { accept: 'text/html', 'accept-encoding': 'identity', 'user-agent': USER_AGENT },
      ...(link.isIpLiteral ? {} : { lookup: vettedLookup(settings), servername: link.hostname }),
    });
    settings.track(request);
    request.on('error', (error: Error) => {
      reject(error instanceof LinkRefusedError ? new LinkRefusedError() : new LinkUnreachableError());
    });
    request.on('response', (response) => {
      answerOf(response, settings, request).then(resolve, reject);
    });
    request.end();
  });
}
