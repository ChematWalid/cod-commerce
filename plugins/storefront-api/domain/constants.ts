import { COLLECTION_LIST_MAX_TAKE } from '@cod/shared';

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
