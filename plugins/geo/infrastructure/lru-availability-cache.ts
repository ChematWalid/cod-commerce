import { STORE_AVAILABILITY_MAX_ENTRIES, STORE_AVAILABILITY_TTL_MS } from '../domain/constants';
import type { AvailabilityCache } from '../domain/ports/availability-cache.port';
import type { TownAvailability } from '../domain/ports/town-availability.port';

/** How an {@link LruAvailabilityCache} is bounded. */
export interface LruAvailabilityCacheOptions {
  readonly maxEntries?: number;
  readonly ttlMs?: number;
  readonly now?: () => number;
}

interface Entry {
  readonly value: TownAvailability | null;
  readonly expiresAt: number;
}

/**
 * The process-local cache of narrowed wilayas, copied from tenancy's `LruHostCache`: a `Map` iterates in insertion
 * order, so re-inserting on read keeps it LRU, and the oldest entries leave past `maxEntries`.
 */
export class LruAvailabilityCache implements AvailabilityCache {
  private readonly entries = new Map<string, Entry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor({ maxEntries, ttlMs, now }: LruAvailabilityCacheOptions = {}) {
    this.maxEntries = maxEntries ?? STORE_AVAILABILITY_MAX_ENTRIES;
    this.ttlMs = ttlMs ?? STORE_AVAILABILITY_TTL_MS;
    this.now = now ?? Date.now;
  }

  get(key: string): TownAvailability | null | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    this.entries.delete(key);
    if (this.now() >= entry.expiresAt) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: TownAvailability | null): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) return;
      this.entries.delete(oldest);
    }
  }
}
