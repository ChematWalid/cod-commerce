import type { CacheEntry, CacheHandler } from 'next/dist/server/lib/cache-handlers/types';
import { readCacheConfig } from './cache-config';
import { MS_PER_SECOND } from './constants';
// Aliased: react-hooks/rules-of-hooks takes any `use…` call for a React hook.
import { useCacheEntryKey as entryKeyOf, useCacheTagKey as tagKeyOf } from './keys';
import {
  type CacheHandlerDeps,
  type CacheRedisClient,
  CacheUnavailableError,
  cacheSetOptions,
  getCacheRedisClient,
  logCacheWarning,
} from './redis-connection';

/** Next's `'use cache'` handler interface (`cacheHandlers`, plural). */
export type UseCacheHandler = CacheHandler;

/** A `'use cache'` entry as stored: the streamed value as base64, the rest as Next gave it. */
interface StoredUseCacheEntry extends Omit<CacheEntry, 'value'> {
  readonly value: string;
}

// Only `expire` makes an entry unusable; past `revalidate` it is stale and Next serves it while refreshing.
const isExpired = (entry: StoredUseCacheEntry): boolean => Date.now() > entry.timestamp + entry.expire * MS_PER_SECOND;

async function readStored(client: CacheRedisClient, key: string): Promise<StoredUseCacheEntry | null> {
  try {
    const text = await client.get(key);
    return text ? (JSON.parse(text) as StoredUseCacheEntry) : null;
  } catch (error) {
    logCacheWarning('use_cache_get_failed', error);
    return null;
  }
}

// Next asks getExpiration only about the route's soft tags, so the entry's own tags (from cacheTag) are
// checked here: a tag revalidated after the entry was written, on any instance, makes it a miss.
async function revalidatedSince(client: CacheRedisClient, tags: readonly string[], since: number): Promise<boolean> {
  if (tags.length === 0) return false;
  try {
    const times = await client.mGet(tags.map(tagKeyOf));
    return times.some((time) => time !== null && Number(time) > since);
  } catch (error) {
    // Without the timestamps it cannot tell, so it does not serve the entry.
    logCacheWarning('use_cache_tag_lookup_failed', error);
    return true;
  }
}

const toCacheEntry = (stored: StoredUseCacheEntry): CacheEntry => ({
  ...stored,
  value: new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Buffer.from(stored.value, 'base64'));
      controller.close();
    },
  }),
});

async function readEntry(deps: CacheHandlerDeps, cacheKey: string): Promise<CacheEntry | undefined> {
  const client = await deps.getClient();
  if (!client) return undefined;
  const stored = await readStored(client, entryKeyOf(deps.deploymentId, cacheKey));
  if (!stored || isExpired(stored)) return undefined;
  if (await revalidatedSince(client, stored.tags, stored.timestamp)) return undefined;
  return toCacheEntry(stored);
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) chunks.push(chunk.value);
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

async function writeEntry(deps: CacheHandlerDeps, cacheKey: string, pending: Promise<CacheEntry>): Promise<void> {
  const client = await deps.getClient();
  if (!client) return;
  const entry = await pending;
  const bytes = await drain(entry.value);
  const stored: StoredUseCacheEntry = { ...entry, value: bytes.toString('base64') };
  try {
    await client.set(entryKeyOf(deps.deploymentId, cacheKey), JSON.stringify(stored), cacheSetOptions(entry.expire));
  } catch (error) {
    logCacheWarning('use_cache_set_failed', error);
  }
}

// The latest revalidation time of the route's soft tags (the implicit tags revalidatePath uses). When Valkey
// cannot answer it reports "just now", so Next regenerates rather than serving a possibly revalidated entry.
async function latestRevalidation(deps: CacheHandlerDeps, tags: string[]): Promise<number> {
  if (tags.length === 0) return 0;
  const client = await deps.getClient();
  if (!client) return Date.now();
  try {
    const timestamps = (await client.mGet(tags.map(tagKeyOf))).filter((time) => time !== null).map(Number);
    return timestamps.length > 0 ? Math.max(...timestamps) : 0;
  } catch (error) {
    logCacheWarning('use_cache_tag_lookup_failed', error);
    return Date.now();
  }
}

async function recordRevalidation(deps: CacheHandlerDeps, tags: string[]): Promise<void> {
  const client = await deps.getClient();
  if (!client) throw new CacheUnavailableError();
  const now = String(Date.now());
  // One key per tag, overwritten in place, with the cap TTL: entries are capped too, so a timestamp always
  // outlives the entries written before it.
  await Promise.all(tags.map((tag) => client.set(tagKeyOf(tag), now, cacheSetOptions(undefined))));
}

/**
 * Builds the `'use cache'` handler over a Valkey client: entries are streams stored as base64, and tag
 * revalidation is tracked by timestamp. Ported from the Next.js `cache-handler-redis` example (see NOTICE.md).
 */
export function createUseCacheHandler(deps: CacheHandlerDeps): UseCacheHandler {
  return {
    get: (cacheKey) => readEntry(deps, cacheKey),
    set: (cacheKey, pendingEntry) => writeEntry(deps, cacheKey, pendingEntry),
    // Every read goes to Valkey, so there is no local tag state to refresh.
    refreshTags: () => Promise.resolve(),
    getExpiration: (tags) => latestRevalidation(deps, tags),
    updateTags: (tags) => recordRevalidation(deps, tags),
  };
}

export default createUseCacheHandler({
  getClient: getCacheRedisClient,
  deploymentId: readCacheConfig(process.env).deploymentId,
});
