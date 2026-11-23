import { PURGE_MAX_HOSTNAMES, PURGE_WINDOW_MS } from '../domain/constants';

/** One CDN purge request: at most {@link PURGE_MAX_HOSTNAMES} hostnames, possibly of several stores. */
export interface PurgeBatch {
  readonly hostnames: readonly string[];
}

/** The limits of a {@link PurgeCoalescer}; the defaults are D3210's. */
export interface PurgeLimits {
  readonly windowMs: number;
  readonly maxHostnames: number;
}

const DEFAULT_LIMITS: PurgeLimits = { windowMs: PURGE_WINDOW_MS, maxHostnames: PURGE_MAX_HOSTNAMES };

/**
 * Coalesces CDN purges (D3210): a store is purged at most once per window however often it publishes, and the
 * hostnames of every store due are sent in requests of at most `maxHostnames`. A request inside the window waits for
 * the next {@link due} after the window. Pure: the clock is injected and nothing is sent from here. State lives in
 * this process only; a purge another worker sent is not seen, which at worst purges a store once per worker.
 */
export class PurgeCoalescer {
  private readonly pending = new Map<string, Set<string>>();
  private readonly lastPurgedAt = new Map<string, number>();

  constructor(
    private readonly now: () => number,
    private readonly limits: PurgeLimits = DEFAULT_LIMITS,
  ) {}

  /** Stores with hostnames waiting for their window. */
  get pendingStores(): number {
    return this.pending.size;
  }

  /** Asks for a purge of `hostnames` of `storeId`; merged with what the store already waits for. */
  request(storeId: string, hostnames: readonly string[]): void {
    if (hostnames.length === 0) return;
    const waiting = this.pending.get(storeId) ?? new Set<string>();
    for (const hostname of hostnames) waiting.add(hostname);
    this.pending.set(storeId, waiting);
  }

  /** Takes the stores whose window is over, marks them purged now, and answers their hostnames in batches. */
  due(): readonly PurgeBatch[] {
    const now = this.now();
    this.forgetExpiredWindows(now);
    const hostnames = new Set<string>();
    for (const [storeId, waiting] of this.pending) {
      if (this.lastPurgedAt.has(storeId)) continue;
      for (const hostname of waiting) hostnames.add(hostname);
      this.pending.delete(storeId);
      this.lastPurgedAt.set(storeId, now);
    }
    return this.batchesOf([...hostnames]);
  }

  private forgetExpiredWindows(now: number): void {
    for (const [storeId, at] of this.lastPurgedAt) {
      if (now - at >= this.limits.windowMs) this.lastPurgedAt.delete(storeId);
    }
  }

  private batchesOf(hostnames: readonly string[]): PurgeBatch[] {
    const batches: PurgeBatch[] = [];
    for (let start = 0; start < hostnames.length; start += this.limits.maxHostnames) {
      batches.push({ hostnames: hostnames.slice(start, start + this.limits.maxHostnames) });
    }
    return batches;
  }
}
