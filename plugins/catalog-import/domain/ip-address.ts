import { BlockList, isIP } from 'node:net';

/**
 * IPv4 networks no link import may reach (D2214): this network, private, CGNAT, loopback, link-local, IETF protocol
 * assignments, documentation, the 6to4 relay, benchmarking, multicast and reserved (broadcast included).
 */
const NON_PUBLIC_IPV4 = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
] as const;

/** The only IPv6 space a public host has: global unicast. */
const GLOBAL_UNICAST_IPV6 = ['2000::/3'] as const;
/** Inside global unicast, IETF protocol assignments (Teredo `2001::/32` among them) and documentation. */
const SPECIAL_GLOBAL_IPV6 = ['2001::/23', '2001:db8::/32', '3fff::/20'] as const;
/** 6to4: as public as the IPv4 address it wraps in its second and third words. */
const SIX_TO_FOUR_IPV6 = ['2002::/16'] as const;

type Family = 'ipv4' | 'ipv6';

function blockListOf(cidrs: readonly string[], family: Family): BlockList {
  const list = new BlockList();
  for (const cidr of cidrs) {
    const [network = '', prefix = ''] = cidr.split('/');
    list.addSubnet(network, Number(prefix), family);
  }
  return list;
}

const NON_PUBLIC_V4 = blockListOf(NON_PUBLIC_IPV4, 'ipv4');
const GLOBAL_V6 = blockListOf(GLOBAL_UNICAST_IPV6, 'ipv6');
const SPECIAL_V6 = blockListOf(SPECIAL_GLOBAL_IPV6, 'ipv6');
const SIX_TO_FOUR_V6 = blockListOf(SIX_TO_FOUR_IPV6, 'ipv6');

/** What `isIP` answers for an IPv4 address. */
const IPV4_FAMILY = 4;
const HEX = 16;
const IPV6_WORDS = 8;
const BYTE_BITS = 8;
const BYTE_MASK = 0xff;
/** The words of a 6to4 address that hold its IPv4 address. */
const SIX_TO_FOUR_WORDS = { high: 1, low: 2 } as const;

/** The eight 16-bit words of a valid IPv6 address with no IPv4 tail (a 6to4 address has none). */
function ipv6Words(address: string): number[] {
  const [head = '', tail] = address.toLowerCase().split('::');
  const headWords = head === '' ? [] : head.split(':');
  const tailWords = tail === undefined || tail === '' ? [] : tail.split(':');
  const zeros = Array.from({ length: IPV6_WORDS - headWords.length - tailWords.length }, () => '0');
  return [...headWords, ...(tail === undefined ? [] : zeros), ...tailWords].map((word) => Number.parseInt(word, HEX));
}

/** The dotted IPv4 address a 6to4 address wraps. */
function sixToFourIpv4(address: string): string {
  const words = ipv6Words(address);
  const high = words[SIX_TO_FOUR_WORDS.high] ?? 0;
  const low = words[SIX_TO_FOUR_WORDS.low] ?? 0;
  return [high >> BYTE_BITS, high & BYTE_MASK, low >> BYTE_BITS, low & BYTE_MASK].join('.');
}

/**
 * Only global unicast (`2000::/3`) is public; inside it, the IETF and documentation blocks are not, and 6to4 is as
 * public as the IPv4 address it wraps. Everything else (unspecified, loopback, IPv4-mapped and IPv4-compatible
 * `::/96`, NAT64 `64:ff9b::/96` and `64:ff9b:1::/48`, discard `100::/64`, unique-local, link-local, site-local,
 * multicast) is refused.
 */
function isPublicIpv6(address: string): boolean {
  if (!GLOBAL_V6.check(address, 'ipv6') || SPECIAL_V6.check(address, 'ipv6')) return false;
  if (!SIX_TO_FOUR_V6.check(address, 'ipv6')) return true;
  return !address.includes('.') && !NON_PUBLIC_V4.check(sixToFourIpv4(address), 'ipv4');
}

/**
 * Whether a link import may connect to `address` (D2214): a valid IPv4 or IPv6 address of the public internet. An
 * address with a zone id, or anything that is no address, is not.
 */
export function isPublicAddress(address: string): boolean {
  if (address.includes('%')) return false;
  const family = isIP(address);
  if (family === 0) return false;
  return family === IPV4_FAMILY ? !NON_PUBLIC_V4.check(address, 'ipv4') : isPublicIpv6(address);
}
