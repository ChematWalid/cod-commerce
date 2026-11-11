import { PLATFORM_STAFF_PERMISSION } from '@cod/shared';

/** The longest business or store name. */
export const NAME_MAX_LENGTH = 255;

/** The longest language code column value. */
export const LANGUAGE_CODE_MAX_LENGTH = 16;

/** The longest status or behaviour column value. */
export const STATE_COLUMN_MAX_LENGTH = 20;

/** The longest DNS host name. */
export const HOST_MAX_LENGTH = 253;

/** The zone every channel taxes and ships by; the platform seed creates it. */
export const ALGERIA_ZONE_NAME = 'Algeria';

/** The role a business's owner holds, unique per business (D6). */
export const ownerRoleCode = (businessId: string): string => `owner-${businessId}`;

/** How long a worker id lease lasts without renewal (ADR 0003). */
export const WORKER_LEASE_TTL_MS = 60_000;

/** How often a held worker id lease is renewed (ADR 0003). */
export const WORKER_LEASE_RENEW_MS = 20_000;

/** The Valkey key of the lease on worker id `workerId` (ADR 0003). */
export const workerLeaseKey = (workerId: number): string => `idgen:worker:${String(workerId)}`;

/**
 * Custom permissions an owner never receives (A1). The dashboard's global saved views are shared by the whole
 * platform, so a merchant writing one would reach every other business.
 */
export const PLATFORM_ONLY_CUSTOM_PERMISSIONS: readonly string[] = [
  'ReadDashboardGlobalViews',
  'WriteDashboardGlobalViews',
  PLATFORM_STAFF_PERMISSION,
];

/** How many hosts each process keeps in memory. */
export const HOST_LRU_MAX_ENTRIES = 10_000;

/** How long a process trusts its in-memory entry: the bound on staleness if an invalidation message is lost. */
export const HOST_LRU_TTL_MS = 60_000;

/** How long after an invalidation the hosts are deleted again, for a resolver that read before the commit. */
export const HOST_REDELETE_DELAY_MS = 500;

/**
 * The namespace of host keys and invalidations when the host passes none. The server passes `APP_ENV`, so two
 * environments that share a Valkey never read each other's store resolutions (TEN-11).
 */
export const HOST_CACHE_DEFAULT_NAMESPACE = 'development';

/** The Valkey channel that tells every process of `namespace` to drop hosts from memory. */
export const hostInvalidateChannel = (namespace: string): string => `host-invalidate:${namespace}`;

/** How many more times a failed delete is retried, doubling from {@link HOST_INVALIDATE_RETRY_BASE_MS}: about 30 s. */
export const HOST_INVALIDATE_RETRIES = 5;

/** The wait before the first retry of a failed delete. */
export const HOST_INVALIDATE_RETRY_BASE_MS = 1000;

/** The backstop on a cached host: a key whose every delete failed during an outage is gone after a day (D16). */
export const HOST_CACHE_TTL_SECONDS = 86_400;

/** How long a request waits for Valkey before reading the database instead; well under the storefront's timeout. */
export const HOST_CACHE_COMMAND_TIMEOUT_MS = 200;

/** The Valkey key of a host's cached store. Invalidation removes it; {@link HOST_CACHE_TTL_SECONDS} is the backstop. */
export const hostCacheKey = (namespace: string, host: string): string => `host:${namespace}:${host}`;
