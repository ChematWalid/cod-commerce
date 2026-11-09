/** Shortest allowed store subdomain. */
export const SUBDOMAIN_MIN_LENGTH = 3;
/** Longest allowed store subdomain (the `varchar(30)` column). */
export const SUBDOMAIN_MAX_LENGTH = 30;

/** Names the platform keeps for itself; no store may use them. */
export const RESERVED_SUBDOMAINS: readonly string[] = [
  'www',
  'api',
  'admin',
  'dashboard',
  'app',
  'mail',
  'static',
  'assets',
  'cdn',
  'status',
  'help',
  'support',
  'internal',
  'store',
  'shop',
];

export type SubdomainStatus = 'available' | 'taken' | 'reserved' | 'invalid';

/** Machine-readable cause of a status other than `available`, for clients that translate it (D39). */
export type SubdomainReasonCode = 'length' | 'format' | 'punycode' | 'reserved' | 'taken';

export interface SubdomainAvailability {
  readonly subdomain: string;
  readonly status: SubdomainStatus;
  /** English text for API users. */
  readonly reason: string | null;
  readonly reasonCode: SubdomainReasonCode | null;
}

const SUBDOMAIN_FORMAT = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
/** The IDNA A-label prefix: a punycode name can render as a lookalike of another store's name. */
const PUNYCODE_PREFIX = 'xn--';

function result(
  subdomain: string,
  status: SubdomainStatus,
  reasonCode: SubdomainReasonCode | null,
  reason: string | null,
): SubdomainAvailability {
  return { subdomain, status, reason, reasonCode };
}

/**
 * Checks a raw subdomain against the format and reserved-name rules. It lowercases and trims first.
 * `available` means only that the format is fine: the caller still checks the database for `taken`.
 */
export function classifySubdomain(raw: string): SubdomainAvailability {
  const subdomain = raw.trim().toLowerCase();
  if (subdomain.length < SUBDOMAIN_MIN_LENGTH || subdomain.length > SUBDOMAIN_MAX_LENGTH) {
    return result(
      subdomain,
      'invalid',
      'length',
      `Must be ${String(SUBDOMAIN_MIN_LENGTH)} to ${String(SUBDOMAIN_MAX_LENGTH)} characters long`,
    );
  }
  if (!SUBDOMAIN_FORMAT.test(subdomain)) {
    return result(
      subdomain,
      'invalid',
      'format',
      'Use only lowercase letters, digits and hyphens, with no hyphen at the start or end',
    );
  }
  if (subdomain.startsWith(PUNYCODE_PREFIX)) {
    return result(subdomain, 'invalid', 'punycode', `Names starting with ${PUNYCODE_PREFIX} are not allowed`);
  }
  if (RESERVED_SUBDOMAINS.includes(subdomain)) {
    return result(subdomain, 'reserved', 'reserved', 'This name is reserved by the platform');
  }
  return result(subdomain, 'available', null, null);
}
