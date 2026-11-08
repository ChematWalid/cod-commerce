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
];
