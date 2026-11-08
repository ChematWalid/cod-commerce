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
