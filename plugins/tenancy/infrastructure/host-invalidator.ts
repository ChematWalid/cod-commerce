import { hostOfSubdomain } from '@cod/shared';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { HOST_INVALIDATE_RETRIES, HOST_INVALIDATE_RETRY_BASE_MS, HOST_REDELETE_DELAY_MS } from '../domain/constants';
import type { HostCachePort } from '../domain/ports/host-cache.port';
import type { HostStoreLookupPort } from '../domain/ports/host-store-lookup.port';
import type { StoreHostChange, StoreHostInvalidatorPort } from '../domain/ports/store-host-invalidator.port';
import type { ValkeyHostCache } from './valkey-host-cache';

const LOG_CONTEXT = 'HostInvalidator';

/** The part of {@link ValkeyHostCache} invalidation needs. */
export type HostInvalidationTarget = Pick<ValkeyHostCache, 'delete' | 'publish' | 'close'>;

/**
 * Forgets a store's hosts after its change has committed. A failure is logged and not thrown: the change is
 * already committed, so the mutation succeeded, and the in-memory tier expires by itself.
 */
export class HostInvalidator implements StoreHostInvalidatorPort, OnApplicationShutdown {
  private readonly pending = new Map<NodeJS.Timeout, readonly string[]>();

  constructor(
    private readonly shared: HostInvalidationTarget,
    private readonly local: HostCachePort,
    private readonly lookup: Pick<HostStoreLookupPort, 'findCustomDomains'>,
    private readonly platformDomain: string,
  ) {}

  async invalidate({ storeId, subdomains }: StoreHostChange): Promise<void> {
    const hosts = subdomains.map((subdomain) => hostOfSubdomain(subdomain, this.platformDomain));
    await this.invalidateHosts([...hosts, ...(await this.customDomainsOf(storeId))]);
  }

  /** Sweeps `hosts` now, and once more after {@link HOST_REDELETE_DELAY_MS}. */
  async invalidateHosts(hosts: readonly string[]): Promise<void> {
    await this.sweep(hosts);
    // A resolver that read the row before the commit can still write the old value after this sweep. Valkey keeps
    // it forever (no TTL), so a second sweep, once such a read has finished, is what removes it.
    this.scheduleSweep(hosts, HOST_REDELETE_DELAY_MS, 0);
  }

  async onApplicationShutdown(): Promise<void> {
    const hosts = [...this.pending.entries()];
    this.pending.clear();
    for (const [timer, pendingHosts] of hosts) {
      clearTimeout(timer);
      await this.sweep(pendingHosts);
    }
    this.shared.close();
  }

  private scheduleSweep(hosts: readonly string[], delayMs: number, retriesUsed: number): void {
    const timer = setTimeout(() => {
      this.pending.delete(timer);
      void this.sweepOrRetry(hosts, retriesUsed);
    }, delayMs);
    timer.unref();
    this.pending.set(timer, hosts);
  }

  /** A delete that fails while Valkey is down would leave the old host served, so it is retried for about 30 s. */
  private async sweepOrRetry(hosts: readonly string[], retriesUsed: number): Promise<void> {
    if (await this.sweep(hosts)) return;
    if (retriesUsed >= HOST_INVALIDATE_RETRIES) {
      Logger.error(`Gave up deleting hosts ${hosts.join(', ')}; they expire with their TTL`, LOG_CONTEXT);
      return;
    }
    this.scheduleSweep(hosts, HOST_INVALIDATE_RETRY_BASE_MS * 2 ** retriesUsed, retriesUsed + 1);
  }

  /** @returns whether the Valkey delete went through */
  private async sweep(hosts: readonly string[]): Promise<boolean> {
    const deleted = await this.attempt('delete from Valkey', hosts, () => this.shared.delete(hosts));
    await this.attempt('publish the invalidation of', hosts, () => this.shared.publish(hosts));
    await this.attempt('drop from memory', hosts, () => this.local.delete(hosts));
    return deleted;
  }

  private async attempt(action: string, hosts: readonly string[], step: () => Promise<void>): Promise<boolean> {
    try {
      await step();
      return true;
    } catch (error) {
      Logger.error(`Could not ${action} hosts ${hosts.join(', ')}: ${String(error)}`, LOG_CONTEXT);
      return false;
    }
  }

  private async customDomainsOf(storeId: StoreHostChange['storeId']): Promise<readonly string[]> {
    try {
      return await this.lookup.findCustomDomains(storeId);
    } catch (error) {
      Logger.error(`Could not list the custom domains of store ${storeId}: ${String(error)}`, LOG_CONTEXT);
      return [];
    }
  }
}
