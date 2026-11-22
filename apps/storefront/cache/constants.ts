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

/**
 * The largest serialised entry the cache writes, in bytes (512 KB, ADR 0006 D4). A bigger page is served
 * uncached: one oversized entry per store would fill the shared `noeviction` Valkey.
 */
export const CACHE_ENTRY_MAX_BYTES = 524_288;

/** How long one cache command may take before it counts as a miss (#121): a stalled Valkey never holds a render. */
export const CACHE_COMMAND_TIMEOUT_MS = 250;

/** At most this many commands wait on one connection; past it new commands fail at once instead of piling up. */
export const CACHE_COMMANDS_QUEUE_MAX_LENGTH = 1000;

/** Share of `maxmemory` at which the memory guard turns cache writes off (ADR 0006 D4: 60 %, BullMQ needs the rest). */
export const CACHE_MEMORY_GUARD_RATIO = 0.6;

/** How often the memory guard reads `INFO memory` and the shared writes-off switch. */
export const CACHE_MEMORY_GUARD_POLL_MS = 30_000;

/** TTL of the shared writes-off switch: it clears itself once no instance sees the memory over the ratio. */
export const CACHE_WRITES_OFF_TTL_SECONDS = 120;

/** Key segment of the writes-off switch, `{APP_ENV}:cache:writes-off`. */
export const WRITES_OFF_SEGMENT = 'cache:writes-off';

/** The lowest score bound of a sorted-set range (`ZREMRANGEBYSCORE key -inf …`). */
export const SCORE_MIN = '-inf';
