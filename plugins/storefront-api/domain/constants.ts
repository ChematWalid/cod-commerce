import { COLLECTION_LIST_MAX_TAKE, STOREFRONT_SEARCH_MAX_QUERY } from '@cod/shared';

/** The outbox consumer that keeps the storefront projection up to date: part of every delivery's job id. */
export const PROJECTION_CONSUMER_NAME = 'storefront-projection';

/** Product ids one projection rebuild reads per page of the store's catalog. */
export const PROJECTION_REBUILD_PAGE_SIZE = 100;

/** Businesses one backfill sweep reads per page of the platform. */
export const PROJECTION_BACKFILL_BUSINESS_PAGE = 100;

/** The scheduled task that rebuilds the projection of stores that have none yet (D3205). */
export const PROJECTION_BACKFILL_TASK_ID = 'storefront-projection-backfill';

/** Every 15 minutes, so a store deployed or restored without a projection is listed soon. */
export const PROJECTION_BACKFILL_SCHEDULE = '*/15 * * * *';

/** Visible collections the storefront lists in one call: a store's menu, never paged further. */
export const STOREFRONT_COLLECTIONS_MAX = COLLECTION_LIST_MAX_TAKE;

/** Most texts one search matches: the query and its synonym variants (ADR 0014), so a search stays bounded. */
export const STOREFRONT_SEARCH_MAX_VARIANTS = 8;

/** Longest synonym term or expansion stored, in characters: a search reads at most this much of a query. */
export const SEARCH_SYNONYM_MAX_LENGTH = STOREFRONT_SEARCH_MAX_QUERY;

/** The outbox consumer that turns catalog and store changes into storefront revalidations (Task 11, D3222). */
export const REVALIDATE_CONSUMER_NAME = 'storefront-revalidate';

/**
 * How long a revalidation waits after its outbox delivery: the projection consumer writes the rows of the same event
 * on its own delivery, so expiring the list pages a little later lets them re-render from the new rows (D3222).
 */
export const REVALIDATE_SETTLE_MS = 2_000;

/** How long the revalidate worker waits for the storefront before the job fails and retries. */
export const REVALIDATE_TIMEOUT_MS = 5_000;

/** At most one CDN purge per store in this window, however often the store publishes (D3210). */
export const PURGE_WINDOW_MS = 30_000;

/** Most hostnames one CDN purge request carries, across stores (D3210, ADR 0012 limits). */
export const PURGE_MAX_HOSTNAMES = 100;

/** How often the worker sends the purges a window held back. */
export const PURGE_FLUSH_INTERVAL_MS = PURGE_WINDOW_MS;

/** The code of a refused quote body that names no shared pricing code (D3303). */
export const QUOTE_REQUEST_INVALID_CODE = 'storefront.invalid-quote-request';

/** What every quote answer, refusals included, says to caches: a quote is one buyer's, priced now (D3303). */
export const QUOTE_CACHE_CONTROL = 'private, no-store';
