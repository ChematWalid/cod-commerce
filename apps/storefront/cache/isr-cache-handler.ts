import { processCacheConfig } from './cache-config';
import { boundedClientOf } from './command-timeout';
import { CACHE_ENTRY_MAX_TTL_SECONDS, MS_PER_SECOND, NEXT_CACHE_TAGS_HEADER, SCORE_MIN } from './constants';
import { deserializeIsrEntry, serializeIsrEntry } from './isr-serialization';
import { isrEntryKey, isrTagKey } from './keys';
import {
  type CacheHandlerDeps,
  type CacheRedisClient,
  CacheUnavailableError,
  cacheSetOptions,
  getCacheRedisClient,
  logCacheEvent,
  logCacheWarning,
} from './redis-connection';
import { fitsEntryLimit, processCacheWriteGuard } from './write-guard';

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
  const client = await boundedClientOf(deps.getClient);
  if (!client) return null;
  try {
    const text = await client.get(isrEntryKey(deps.deploymentId, key));
    return text ? (deserializeIsrEntry(text) as StoredIsrEntry) : null;
  } catch (error) {
    // A connection dropping or stalling mid-request degrades to a miss.
    logCacheWarning('isr_get_failed', error);
    return null;
  }
}

// One transaction: ZADD scored by the entry's expiry, then the members already expired are pruned (#183), then
// the TTL is refreshed, so the index never exists without its TTL and never outgrows the live entries.
async function indexUnderTag(
  client: CacheRedisClient,
  tag: string,
  entryKey: string,
  expiresAt: number,
): Promise<void> {
  const tagKey = isrTagKey(tag);
  await client
    .multi()
    .zAdd(tagKey, { score: expiresAt, value: entryKey })
    .zRemRangeByScore(tagKey, SCORE_MIN, Date.now())
    .expire(tagKey, CACHE_ENTRY_MAX_TTL_SECONDS)
    .exec();
}

/** An ISR entry ready to write: its key, its tags and its serialised value. */
interface IsrWrite {
  readonly entryKey: string;
  readonly tags: readonly string[];
  readonly value: string;
}

/** The write of an entry, or `null` when it is over the size limit (it is then served uncached). */
function isrWriteOf(deps: CacheHandlerDeps, key: string, data: unknown, ctx?: IsrSetContext): IsrWrite | null {
  const tags = [...new Set([...(ctx?.tags ?? []), ...headerTags(data)])];
  const value = serializeIsrEntry({ value: data, lastModified: Date.now(), tags });
  if (fitsEntryLimit(value)) return { entryKey: isrEntryKey(deps.deploymentId, key), tags, value };
  logCacheEvent('entry_too_large', { kind: 'isr', bytes: Buffer.byteLength(value, 'utf8') });
  return null;
}

// The tags are indexed before the entry is written: if indexing fails the entry is not written, so a tag
// revalidation can never miss a stored entry.
async function storeIndexed(client: CacheRedisClient, write: IsrWrite, expire: number | undefined): Promise<void> {
  const options = cacheSetOptions(expire);
  const expiresAt = Date.now() + options.expiration.value * MS_PER_SECOND;
  try {
    for (const tag of write.tags) await indexUnderTag(client, tag, write.entryKey, expiresAt);
    await client.set(write.entryKey, write.value, options);
  } catch (error) {
    logCacheWarning('isr_set_failed', error);
  }
}

// Oversized entries and writes while the writes-off switch is set are skipped (#120).
async function writeEntry(deps: CacheHandlerDeps, key: string, data: unknown, ctx?: IsrSetContext): Promise<void> {
  const client = await boundedClientOf(deps.getClient);
  if (!client || !data) return;
  const write = isrWriteOf(deps, key, data, ctx);
  if (!write || !(await deps.writeGuard.allowsWrites(client))) return;
  await storeIndexed(client, write, ctx?.cacheControl?.expire);
}

// The entries and their index members go in one transaction. Only the members read here are removed, not the
// whole index: an entry indexed meanwhile keeps its member, so the next revalidation still reaches it.
async function revalidateTags(deps: CacheHandlerDeps, tags: string | readonly string[]): Promise<void> {
  const client = await boundedClientOf(deps.getClient);
  if (!client) throw new CacheUnavailableError();
  for (const tag of typeof tags === 'string' ? [tags] : tags) {
    const tagKey = isrTagKey(tag);
    const keys = await client.zRange(tagKey, 0, -1);
    if (keys.length === 0) continue;
    await client.multi().del(keys).zRem(tagKey, keys).zRemRangeByScore(tagKey, SCORE_MIN, Date.now()).exec();
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
  deploymentId: processCacheConfig().deploymentId,
  writeGuard: processCacheWriteGuard(),
});
