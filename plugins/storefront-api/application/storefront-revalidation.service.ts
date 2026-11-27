import type { CdnPurgePort } from '../domain/ports/cdn-purge.port';
import type { StoreHostsPort } from '../domain/ports/store-hosts.port';
import type { StorefrontRevalidatorPort } from '../domain/ports/storefront-revalidator.port';
import type { PurgeCoalescer } from './purge-coalescer';

/** Where a failed purge is reported: the use case has no logger of its own. */
export interface RevalidationLog {
  warn(message: string): void;
}

/** What a storefront revalidation runs with. */
export interface RevalidationPorts {
  readonly revalidator: StorefrontRevalidatorPort;
  readonly hosts: StoreHostsPort;
  readonly purge: CdnPurgePort;
  readonly coalescer: PurgeCoalescer;
  readonly log: RevalidationLog;
}

/**
 * Expires a store's storefront cache entries, then purges its hostnames on the CDN through the coalescer (ADR 0006,
 * D3210). The storefront must confirm, or the call fails and its job retries; a failed purge is only logged, since the
 * CDN keeps a page for 60 s at most (`Cloudflare-CDN-Cache-Control`).
 */
export class StorefrontRevalidation {
  constructor(private readonly ports: RevalidationPorts) {}

  /** Expires `tags` on the storefront and asks for a purge of the store's hostnames. */
  async revalidate(storeId: string, tags: readonly string[]): Promise<void> {
    await this.ports.revalidator.revalidate(tags);
    this.ports.coalescer.request(storeId, await this.ports.hosts.hostsOf(storeId));
    await this.flushPurges();
  }

  /** Sends the purges whose window is over; answers how many requests were sent. */
  async flushPurges(): Promise<number> {
    let sent = 0;
    for (const batch of this.ports.coalescer.due()) {
      try {
        await this.ports.purge.purgeHosts(batch.hostnames);
        sent += 1;
      } catch (error: unknown) {
        const reason = error instanceof Error ? error.name : typeof error;
        this.ports.log.warn(`CDN purge of ${String(batch.hostnames.length)} hostname(s) failed: ${reason}`);
      }
    }
    return sent;
  }
}
