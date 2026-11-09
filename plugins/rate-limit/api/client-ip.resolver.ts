import { isIP, isIPv4 } from 'node:net';
import { UNKNOWN_CLIENT } from '../domain/constants';

/** The parts of an HTTP request the resolver reads; Express's `Request` fits. */
export interface ClientRequest {
  readonly ip: string | undefined;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

const IPV6_GROUPS = 8;
/** An IPv6 network is 64 bits: the first four of eight 16-bit groups. A household or host gets the whole /64. */
const IPV6_NETWORK_GROUPS = 4;
const IPV4_MAPPED_GROUP = 5;
const HEX_RADIX = 16;
const BYTE = 256;

/** The eight 16-bit groups of an IPv6 address, `::` and a dotted IPv4 tail expanded. */
function ipv6Groups(address: string): number[] {
  const withoutZone = address.split('%')[0] ?? address;
  const lastColon = withoutZone.lastIndexOf(':');
  const tail = withoutZone.slice(lastColon + 1);
  const text = isIPv4(tail)
    ? `${withoutZone.slice(0, lastColon + 1)}${tail
        .split('.')
        .map(Number)
        .reduce<number[]>((pairs, octet, index) => {
          pairs[Math.floor(index / 2)] = (pairs[Math.floor(index / 2)] ?? 0) * BYTE + octet;
          return pairs;
        }, [])
        .map((pair) => pair.toString(HEX_RADIX))
        .join(':')}`
    : withoutZone;
  const [head = '', rest] = text.split('::');
  const front = head === '' ? [] : head.split(':');
  const back = rest === undefined || rest === '' ? [] : rest.split(':');
  const fill = rest === undefined ? [] : Array<string>(IPV6_GROUPS - front.length - back.length).fill('0');
  return [...front, ...fill, ...back].map((group) => parseInt(group, HEX_RADIX));
}

/**
 * The key of one client: IPv4 as written, IPv4-mapped IPv6 as the IPv4 it wraps, and any other IPv6 address as
 * its /64 network (`2001:db8:0:0::/64`), because one subscriber can freely pick addresses within its /64.
 */
function canonical(address: string): string {
  const lower = address.toLowerCase();
  if (isIPv4(lower)) {
    return lower;
  }
  const groups = ipv6Groups(lower);
  const mapped =
    groups.slice(0, IPV4_MAPPED_GROUP).every((group) => group === 0) && groups[IPV4_MAPPED_GROUP] === 0xffff;
  if (mapped) {
    return [groups[6] ?? 0, groups[7] ?? 0].flatMap((pair) => [Math.floor(pair / BYTE), pair % BYTE]).join('.');
  }
  return `${groups
    .slice(0, IPV6_NETWORK_GROUPS)
    .map((group) => group.toString(HEX_RADIX))
    .join(':')}::/64`;
}

/**
 * Decides which address a request is limited by (D31). `req.ip` is what Express derives with `trustProxy: 1`:
 * the last `X-Forwarded-For` hop when the header is present (a client can prepend entries but not change that
 * hop), else the socket address. Behind the edge that hop is the edge's own address, so production names the
 * header the edge sets (`cf-connecting-ip`) and boot requires it. With no header configured `req.ip` is used
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
