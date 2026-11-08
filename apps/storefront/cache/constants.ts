/** Root segment of every key the storefront cache writes to Valkey (ADR 0006 D4: `next:{deploymentId}:`). */
export const CACHE_KEY_ROOT = 'next';

/**
 * Upper bound for the TTL of every cache entry and tag index, in seconds (6 h). At Launch the cache shares a
 * `noeviction` Valkey with BullMQ (ADR 0013), so a key without a TTL could fill it up.
 */
export const CACHE_ENTRY_MAX_TTL_SECONDS = 21_600;

/** The shortest TTL Valkey accepts for `EX`. */
export const CACHE_ENTRY_MIN_TTL_SECONDS = 1;

/** How long a request waits for the first Valkey connection before it is served uncached. */
export const CONNECT_TIMEOUT_MS = 1000;

/** Key segment of ISR, route-cache and App Shell entries (the singular `cacheHandler`). */
export const ISR_SEGMENT = 'isr';

/** Key segment of `'use cache'` entries (the plural `cacheHandlers`). */
export const USE_CACHE_SEGMENT = 'uc';

/** Key segment of the ISR tag index sets. */
export const ISR_TAG_SEGMENT = 'tag';

/** Key segment of the `'use cache'` tag revalidation timestamps. */
export const USE_CACHE_TAG_SEGMENT = 'uc-tag';

/** App page and route entries carry their tags in this header rather than in the set context. */
export const NEXT_CACHE_TAGS_HEADER = 'x-next-cache-tags';

/** The deployment id used when none is configured, in development only. */
export const DEV_DEPLOYMENT_ID = 'dev';

/** The host-run development Valkey (root docker-compose.yml publishes it on 6380). */
export const DEV_REDIS_URL = 'redis://localhost:6380';

/** The `APP_ENV` value in which a missing `NEXT_DEPLOYMENT_ID` falls back to {@link DEV_DEPLOYMENT_ID}. */
export const DEVELOPMENT_APP_ENV = 'development';

/** Milliseconds per second, for the timestamp arithmetic of `'use cache'` entries. */
export const MS_PER_SECOND = 1000;
