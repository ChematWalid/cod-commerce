import {
  normalizeHost,
  type NormalizedHost,
  type PlatformLanguageCode,
  type SoldOutBehavior,
  type StorefrontDirection,
  storefrontStoreSchema,
} from '@cod/shared';
import { HOST_MAX_LENGTH } from './constants';

/**
 * What a buyer-facing client learns about the store behind a host: the shared `StorefrontStore` contract (D3203),
 * plus `logo`, the old name of `logoPath`, kept for one release. Never the channel, seller or subdomain row.
 */
export interface StoreResolution {
  readonly storeId: string;
  readonly businessId: string;
  readonly language: PlatformLanguageCode;
  readonly name: string;
  readonly description: string;
  /** The asset's `preview` storage path, never a URL; same value as `logoPath`. */
  readonly logo: string | null;
  readonly logoPath: string | null;
  readonly direction: StorefrontDirection;
  readonly primaryHost: string;
  readonly showAddressField: boolean;
  readonly soldOutBehavior: SoldOutBehavior;
  readonly status: 'active';
}

/**
 * True when `value` has the shape of a {@link StoreResolution}. A cached entry is data from outside the process
 * (another version, another tool, a bad write), so it is checked before it is trusted (TEN-11); an entry of an
 * older shape fails too, and is read again from the database (D3203).
 */
export function isStoreResolution(value: unknown): value is StoreResolution {
  if (!storefrontStoreSchema.safeParse(value).success) return false;
  const { logo, logoPath } = value as Record<string, unknown>;
  return logo === logoPath;
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
