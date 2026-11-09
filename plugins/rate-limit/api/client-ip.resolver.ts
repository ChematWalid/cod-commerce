import { isIP, isIPv4 } from 'node:net';
import { UNKNOWN_CLIENT } from '../domain/constants';

/** The parts of an HTTP request the resolver reads; Express's `Request` fits. */
export interface ClientRequest {
  readonly ip: string | undefined;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

const IPV4_MAPPED_PREFIX = '::ffff:';

/** Lowercase, with an IPv4-mapped IPv6 address written as plain IPv4, so one client has one spelling. */
function canonical(address: string): string {
  const lower = address.toLowerCase();
  if (lower.startsWith(IPV4_MAPPED_PREFIX) && isIPv4(lower.slice(IPV4_MAPPED_PREFIX.length))) {
    return lower.slice(IPV4_MAPPED_PREFIX.length);
  }
  return lower;
}

/**
 * Decides which address a request is limited by (D31). Behind the edge, `req.ip` is the edge's address, so
 * production names the header the edge sets (`cf-connecting-ip`). With no header configured, `req.ip` is used
 * and a client-sent header is ignored. A configured header is only believed when it holds one valid address;
 * the origin must not be reachable except through the edge, or the header can be forged.
 */
export class ClientIpResolver {
  private readonly header: string;

  constructor(header: string) {
    this.header = header.trim().toLowerCase();
  }

  /** The address to key `request` by. */
  resolve(request: ClientRequest): string {
    const fromHeader = this.fromHeader(request);
    if (fromHeader !== undefined) {
      return fromHeader;
    }
    return request.ip === undefined || request.ip === '' ? UNKNOWN_CLIENT : canonical(request.ip);
  }

  private fromHeader(request: ClientRequest): string | undefined {
    if (this.header === '') {
      return undefined;
    }
    const value = request.headers[this.header];
    if (typeof value !== 'string') {
      return undefined;
    }
    const candidate = value.trim();
    return isIP(candidate) === 0 ? undefined : canonical(candidate);
  }
}
