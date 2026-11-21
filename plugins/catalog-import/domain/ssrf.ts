import { isIP } from 'node:net';
import { LINK_PORTS } from './constants';
import { LinkRefusedError } from './errors';
import { isPublicAddress } from './ip-address';

export { isPublicAddress } from './ip-address';

/** Answers every address a host name resolves to (DNS in production, a stub in tests). */
export interface HostResolver {
  resolve(hostname: string): Promise<readonly string[]>;
}

/** Which ports a link may name. */
export interface PortPolicy {
  allows(port: number): boolean;
}

/** The production port policy: 80 and 443 only (D2214). */
export const DEFAULT_LINK_PORTS: PortPolicy = { allows: (port) => (LINK_PORTS as readonly number[]).includes(port) };

/** A link the guard lets through: the host to connect to (an address, or a name still to resolve and vet) and port. */
export interface VettedLink {
  readonly ok: true;
  readonly url: URL;
  /** The host as the URL spells it, without the brackets of an IPv6 literal. */
  readonly hostname: string;
  readonly port: number;
  /** An address the URL names: already classified, never resolved. */
  readonly isIpLiteral: boolean;
}

/** The guard's verdict on one link; a refusal says nothing about why. */
export type LinkVerdict = VettedLink | { readonly ok: false };

const REFUSED: LinkVerdict = { ok: false };
const DEFAULT_PORT_OF: Readonly<Record<string, number>> = { 'http:': 80, 'https:': 443 };
/** Names of private networks, never of a public shop: one label, `localhost` and these suffixes. */
const INTERNAL_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.lan', '.intranet', '.home.arpa'];

/** Whether a host name (no address) can only name a machine of a private network. */
function isInternalName(hostname: string): boolean {
  const name = hostname.toLowerCase().replace(/\.$/, '');
  if (name === '' || name === 'localhost' || !name.includes('.')) return true;
  return INTERNAL_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/** The host of a vetted URL: an address the URL names (classified now) or a name to resolve, or none. */
function vetHost(url: URL): { hostname: string; isIpLiteral: boolean } | undefined {
  // WHATWG parsing already turned `2130706433`, `0x7f000001`, `0177.0.0.1`, `127.1` and `0` into dotted addresses,
  // lower-cased names and refused zone ids.
  const hostname = url.hostname.startsWith('[') ? url.hostname.slice(1, -1) : url.hostname;
  if (isIP(hostname) !== 0) return isPublicAddress(hostname) ? { hostname, isIpLiteral: true } : undefined;
  return isInternalName(hostname) ? undefined : { hostname, isIpLiteral: false };
}

/**
 * Vets one link before any connection (D2214): an absolute `http:`/`https:` URL with no userinfo, a port the policy
 * allows, and a host that is a public address or a name of no private network. The name's addresses are vetted when
 * it is resolved, on every connection ({@link resolveVettedHost}).
 */
export function vetLinkTarget(link: string, ports: PortPolicy = DEFAULT_LINK_PORTS): LinkVerdict {
  if (!URL.canParse(link)) return REFUSED;
  const url = new URL(link);
  const defaultPort = DEFAULT_PORT_OF[url.protocol];
  if (defaultPort === undefined || url.username !== '' || url.password !== '') return REFUSED;
  const port = url.port === '' ? defaultPort : Number(url.port);
  if (!ports.allows(port)) return REFUSED;
  const host = vetHost(url);
  return host === undefined ? REFUSED : { ok: true, url, port, ...host };
}

/**
 * The addresses of `hostname`, refused unless there is at least one and **every** one is public (D2214). NXDOMAIN, a
 * DNS failure and a private address answer the same {@link LinkRefusedError}, carrying neither address nor cause.
 * @throws LinkRefusedError
 */
export async function resolveVettedHost(hostname: string, resolver: HostResolver): Promise<readonly string[]> {
  const addresses = await resolver.resolve(hostname).then(
    (answer) => answer,
    (): readonly string[] => [],
  );
  if (addresses.length === 0 || !addresses.every(isPublicAddress)) throw new LinkRefusedError();
  return addresses;
}
