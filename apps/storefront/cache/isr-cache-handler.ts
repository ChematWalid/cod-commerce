import { readCacheConfig } from './cache-config';
import { CACHE_ENTRY_MAX_TTL_SECONDS, NEXT_CACHE_TAGS_HEADER } from './constants';
import { deserializeIsrEntry, serializeIsrEntry } from './isr-serialization';
import { isrEntryKey, isrTagKey } from './keys';
import {
  type CacheHandlerDeps,
  type CacheRedisClient,
  CacheUnavailableError,
  cacheSetOptions,
  getCacheRedisClient,
  logCacheWarning,
} from './redis-connection';

/** The part of Next's `set` context the handler reads. */
export interface IsrSetContext {
  /** Tags of fetch entries; page and route entries carry theirs in a header instead. */
  readonly tags?: readonly string[];
  readonly cacheControl?: { readonly expire?: number };
}

/** What is stored under an ISR key and returned on a hit. */
export interface StoredIsrEntry {
  readonly value: unknown;
  readonly lastModified: number;
  readonly tags: readonly string[];
}

/** Next's ISR cache handler interface (`cacheHandler`, singular): ISR, the route cache and the App Shell. */
export interface IsrCacheHandler {
  get(key: string): Promise<StoredIsrEntry | null>;
  set(key: string, data: unknown, ctx?: IsrSetContext): Promise<void>;
  revalidateTag(tags: string | readonly string[]): Promise<void>;
  resetRequestCache(): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The tags of an app page or route entry, from its `x-next-cache-tags` header. */
function headerTags(data: unknown): string[] {
  if (!isRecord(data) || !isRecord(data['headers'])) return [];
  const header = data['headers'][NEXT_CACHE_TAGS_HEADER];
  return typeof header === 'string' ? header.split(',').filter(Boolean) : [];
}

async function readEntry(deps: CacheHandlerDeps, key: string): Promise<StoredIsrEntry | null> {
  const client = await deps.getClient();
  if (!client) return null;
  try {
    const text = await client.get(isrEntryKey(deps.deploymentId, key));
    return text ? (deserializeIsrEntry(text) as StoredIsrEntry) : null;
  } catch (error) {
    // A connection dropping mid-request degrades to a miss.
    logCacheWarning('isr_get_failed', error);
    return null;
  }
}

async function indexUnderTag(client: CacheRedisClient, tag: string, entryKey: string): Promise<void> {
  const tagKey = isrTagKey(tag);
  await client.sAdd(tagKey, entryKey);
  // Refreshed on every write: the index outlives every entry it lists, since entries are capped too.
  await client.expire(tagKey, CACHE_ENTRY_MAX_TTL_SECONDS);
}

async function writeEntry(deps: CacheHandlerDeps, key: string, data: unknown, ctx?: IsrSetContext): Promise<void> {
  const client = await deps.getClient();
  if (!client || !data) return;
  const tags = [...new Set([...(ctx?.tags ?? []), ...headerTags(data)])];
  const entryKey = isrEntryKey(deps.deploymentId, key);
  const value = serializeIsrEntry({ value: data, lastModified: Date.now(), tags });
  try {
    await client.set(entryKey, value, cacheSetOptions(ctx?.cacheControl?.expire));
    await Promise.all(tags.map((tag) => indexUnderTag(client, tag, entryKey)));
  } catch (error) {
    logCacheWarning('isr_set_failed', error);
  }
}

async function revalidateTags(deps: CacheHandlerDeps, tags: string | readonly string[]): Promise<void> {
  const client = await deps.getClient();
  if (!client) throw new CacheUnavailableError();
  for (const tag of typeof tags === 'string' ? [tags] : tags) {
    const tagKey = isrTagKey(tag);
    const keys = await client.sMembers(tagKey);
    if (keys.length > 0) await client.del(keys);
    await client.del(tagKey);
  }
}

/**
 * Builds the ISR cache handler class over a Valkey client. Next constructs the class once per request, so
 * the client comes from `deps` (module scope), never from the constructor. Ported from the Next.js
 * `cache-handler-redis` example (see NOTICE.md).
 */
export function createIsrCacheHandler(deps: CacheHandlerDeps): new (options: unknown) => IsrCacheHandler {
  return class ValkeyIsrCacheHandler implements IsrCacheHandler {
    readonly options: unknown;

    constructor(options: unknown) {
      this.options = options;
    }

    get(key: string): Promise<StoredIsrEntry | null> {
      return readEntry(deps, key);
    }

    set(key: string, data: unknown, ctx?: IsrSetContext): Promise<void> {
      return writeEntry(deps, key, data, ctx);
    }

    revalidateTag(tags: string | readonly string[]): Promise<void> {
      return revalidateTags(deps, tags);
    }

    resetRequestCache(): void {
      // Valkey is the source of truth: there is no per-request state to reset.
    }
  };
}

export default createIsrCacheHandler({
  getClient: getCacheRedisClient,
  deploymentId: readCacheConfig(process.env).deploymentId,
});
