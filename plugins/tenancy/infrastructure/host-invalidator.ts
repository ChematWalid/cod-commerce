import { hostOfSubdomain } from '@cod/shared';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Logger } from '@vendure/core';
import { HOST_REDELETE_DELAY_MS } from '../domain/constants';
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
    const timer = setTimeout(() => {
      this.pending.delete(timer);
      void this.sweep(hosts);
    }, HOST_REDELETE_DELAY_MS);
    timer.unref();
    this.pending.set(timer, hosts);
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

  private async sweep(hosts: readonly string[]): Promise<void> {
    await this.attempt('delete from Valkey', hosts, () => this.shared.delete(hosts));
    await this.attempt('publish the invalidation of', hosts, () => this.shared.publish(hosts));
    await this.attempt('drop from memory', hosts, () => this.local.delete(hosts));
  }

  private async attempt(action: string, hosts: readonly string[], step: () => Promise<void>): Promise<void> {
    try {
      await step();
    } catch (error) {
      Logger.error(`Could not ${action} hosts ${hosts.join(', ')}: ${String(error)}`, LOG_CONTEXT);
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
