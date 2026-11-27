import { normalizeHost } from './host';
import type { ResolvedStore } from './store-resolver';

/** How many hosts the in-process cache keeps (ADR 0006: 10 000). */
export const STORE_LRU_MAX_ENTRIES = 10_000;
/** How long a found store is reused before the api is asked again: a settings change shows within this. */
export const STORE_LRU_POSITIVE_TTL_MS = 60_000;
/** How long an unknown host is remembered (#180): short, so a store created meanwhile appears soon. */
export const STORE_LRU_NEGATIVE_TTL_MS = 15_000;

/** A cache hit: the store, or `null` for a host known to have none. */
export interface StoreLruHit {
  readonly store: ResolvedStore | null;
}

/** What a {@link StoreLru} can be tuned with; the defaults are the ADR values. */
export interface StoreLruOptions {
  readonly maxEntries?: number;
  readonly positiveTtlMs?: number;
  readonly negativeTtlMs?: number;
  readonly now?: () => number;
}

interface StoreLruEntry extends StoreLruHit {
  readonly expiresAt: number;
}

/**
 * The storefront's in-process host → store cache, positive and negative, least recently used first out.
 * Keys are normalised hosts, so `Demo.LOCALHOST.` and `demo.localhost:3001` share one entry.
 */
export class StoreLru {
  private readonly entries = new Map<string, StoreLruEntry>();
  private readonly maxEntries: number;
  private readonly positiveTtlMs: number;
  private readonly negativeTtlMs: number;
  private readonly now: () => number;

  constructor(options: StoreLruOptions = {}) {
    this.maxEntries = options.maxEntries ?? STORE_LRU_MAX_ENTRIES;
    this.positiveTtlMs = options.positiveTtlMs ?? STORE_LRU_POSITIVE_TTL_MS;
    this.negativeTtlMs = options.negativeTtlMs ?? STORE_LRU_NEGATIVE_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  /** How many hosts are cached. */
  get size(): number {
    return this.entries.size;
  }

  /** The cached answer for `host`, or `undefined` when there is none or it has expired. */
  get(host: string): StoreLruHit | undefined {
    const key = normalizeHost(host);
    const entry = key === null ? undefined : this.entries.get(key);
    if (key === null || entry === undefined) return undefined;
    this.entries.delete(key);
    if (entry.expiresAt <= this.now()) return undefined;
    // Re-inserted, so the Map's insertion order is the recency order.
    this.entries.set(key, entry);
    return { store: entry.store };
  }

  /** Caches `store` (or `null`, an unknown host) for `host`, evicting the least recently used past the limit. */
  set(host: string, store: ResolvedStore | null): void {
    const key = normalizeHost(host);
    if (key === null) return;
    const ttl = store === null ? this.negativeTtlMs : this.positiveTtlMs;
    this.entries.delete(key);
    this.entries.set(key, { store, expiresAt: this.now() + ttl });
    if (this.entries.size <= this.maxEntries) return;
    const oldest = this.entries.keys().next();
    if (oldest.done !== true) this.entries.delete(oldest.value);
  }
}
