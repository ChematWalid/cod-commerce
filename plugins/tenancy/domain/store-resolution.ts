import { normalizeHost, type NormalizedHost } from '@cod/shared';
import { HOST_MAX_LENGTH } from './constants';

/** What a buyer-facing client learns about the store behind a host. */
export interface StoreResolution {
  readonly storeId: string;
  readonly businessId: string;
  readonly language: string;
  readonly name: string;
  /** The asset's `preview` URL. */
  readonly logo: string | null;
  readonly primaryHost: string;
  readonly status: 'active';
}

const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * True when `value` has the shape of a {@link StoreResolution}. A cached entry is data from outside the process
 * (another version, another tool, a bad write), so it is checked before it is trusted (TEN-11).
 */
export function isStoreResolution(value: unknown): value is StoreResolution {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  const textFields = [entry['storeId'], entry['businessId'], entry['language'], entry['name'], entry['primaryHost']];
  return (
    textFields.every(isString) && (entry['logo'] === null || isString(entry['logo'])) && entry['status'] === 'active'
  );
}

const DNS_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

/**
 * Turns a raw host into the form hosts are stored under. Anything that is not a DNS name (a repeated query
 * parameter, an IPv6 literal, a NUL byte) can name no store, and must not reach the database.
 *
 * @returns `null` when `raw` can name no store
 */
export function toLookupHost(raw: unknown): NormalizedHost | null {
  if (typeof raw !== 'string') return null;
  const host = normalizeHost(raw);
  if (host === null || host.length > HOST_MAX_LENGTH || !DNS_HOST.test(host)) return null;
  return host;
}
