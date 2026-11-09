/** A `Host` value lowercased, without its port and without one trailing dot. */
export type NormalizedHost = string & { readonly __brand: 'NormalizedHost' };

/** A trailing `:port`. A bracketed IPv6 host keeps its brackets: in `[::1]:3001` only `:3001` matches. */
const PORT_SUFFIX = /:\d+$/;

/**
 * Normalises a raw `Host` header for store lookup: lowercase, `:port` stripped, one trailing dot stripped.
 *
 * @returns `null` for a missing or empty host
 */
export function normalizeHost(rawHost: string | null): NormalizedHost | null {
  const host = (rawHost ?? '').trim().toLowerCase().replace(PORT_SUFFIX, '');
  const withoutDot = host.endsWith('.') ? host.slice(0, -1) : host;
  return withoutDot === '' ? null : (withoutDot as NormalizedHost);
}

/**
 * The store subdomain of a normalised host: exactly one label before the platform domain.
 *
 * @returns `null` for the bare platform domain, a nested host or any other domain
 */
export function subdomainOfHost(host: string, platformDomain: string): string | null {
  const suffix = `.${platformDomain}`;
  if (!host.endsWith(suffix)) {
    return null;
  }
  const label = host.slice(0, -suffix.length);
  return label === '' || label.includes('.') ? null : label;
}

/** The host a store is served on: `<subdomain>.<platformDomain>`. */
export function hostOfSubdomain(subdomain: string, platformDomain: string): string {
  return `${subdomain}.${platformDomain}`;
}
