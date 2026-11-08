import { HOST_LRU_MAX_ENTRIES, HOST_LRU_TTL_MS } from '../domain/constants';
import type { HostCachePort } from '../domain/ports/host-cache.port';
import type { StoreResolution } from '../domain/store-resolution';

/** How an {@link LruHostCache} is bounded. */
export interface LruHostCacheOptions {
  readonly maxEntries?: number;
  readonly ttlMs?: number;
  readonly now?: () => number;
}

interface Entry {
  readonly value: StoreResolution;
  readonly expiresAt: number;
}

/** The process-local tier. A `Map` iterates in insertion order, so re-inserting on read keeps it LRU. */
export class LruHostCache implements HostCachePort {
  private readonly entries = new Map<string, Entry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor({ maxEntries, ttlMs, now }: LruHostCacheOptions = {}) {
    this.maxEntries = maxEntries ?? HOST_LRU_MAX_ENTRIES;
    this.ttlMs = ttlMs ?? HOST_LRU_TTL_MS;
    this.now = now ?? Date.now;
  }

  get(host: string): Promise<StoreResolution | null> {
    const entry = this.entries.get(host);
    if (entry === undefined) return Promise.resolve(null);
    this.entries.delete(host);
    if (this.now() >= entry.expiresAt) return Promise.resolve(null);
    this.entries.set(host, entry);
    return Promise.resolve(entry.value);
  }

  set(host: string, value: StoreResolution): Promise<void> {
    this.entries.delete(host);
    this.entries.set(host, { value, expiresAt: this.now() + this.ttlMs });
    this.evictOverflow();
    return Promise.resolve();
  }

  delete(hosts: readonly string[]): Promise<void> {
    hosts.forEach((host) => this.entries.delete(host));
    return Promise.resolve();
  }

  private evictOverflow(): void {
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) return;
      this.entries.delete(oldest);
    }
  }
}
