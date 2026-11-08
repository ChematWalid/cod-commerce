import { hostOfSubdomain, InvalidSnowflakeError, type Snowflake, subdomainOfHost, toSnowflake } from '@cod/shared';
import type { HostCachePort } from '../domain/ports/host-cache.port';
import type { HostStoreLookupPort, HostStoreRow } from '../domain/ports/host-store-lookup.port';
import { type StoreResolution, toLookupHost } from '../domain/store-resolution';

/** What {@link ResolveHostService} runs on. */
export interface ResolveHostDependencies {
  readonly local: HostCachePort;
  readonly shared: HostCachePort;
  readonly lookup: HostStoreLookupPort;
  readonly platformDomain: string;
}

function parseStoreId(raw: string): Snowflake | null {
  try {
    return toSnowflake(raw);
  } catch (error) {
    if (error instanceof InvalidSnowflakeError) return null;
    throw error;
  }
}

/** Finds the store behind a host: process memory, then Valkey, then the database. */
export class ResolveHostService {
  constructor(private readonly dependencies: ResolveHostDependencies) {}

  /**
   * The store serving `rawHost`, in any form a `Host` header can take.
   *
   * @returns `null` for an unknown, malformed or archived host; a miss is not cached, so a new store resolves at once
   */
  async resolve(rawHost: unknown): Promise<StoreResolution | null> {
    const host = toLookupHost(rawHost);
    if (host === null) return null;
    const cached = await this.fromCaches(host);
    if (cached !== null) return cached;
    const row = await this.lookUp(host);
    if (row === null) return null;
    const resolution = this.toResolution(row);
    // Not awaited: the adapter logs its own failures, and a buyer's request must not wait on the cache write.
    void this.dependencies.shared.set(host, resolution);
    await this.dependencies.local.set(host, resolution);
    return resolution;
  }

  /** The active store with this id, read from the database: the caller caches by store tag. */
  async findById(rawId: string): Promise<StoreResolution | null> {
    const id = parseStoreId(rawId);
    if (id === null) return null;
    const row = await this.dependencies.lookup.findById(id);
    return row === null ? null : this.toResolution(row);
  }

  private async fromCaches(host: string): Promise<StoreResolution | null> {
    const { local, shared } = this.dependencies;
    const inMemory = await local.get(host);
    if (inMemory !== null) return inMemory;
    const inValkey = await shared.get(host);
    if (inValkey !== null) await local.set(host, inValkey);
    return inValkey;
  }

  private lookUp(host: string): Promise<HostStoreRow | null> {
    const { lookup, platformDomain } = this.dependencies;
    const subdomain = subdomainOfHost(host, platformDomain);
    return subdomain === null ? lookup.findByCustomDomain(host) : lookup.findBySubdomain(subdomain);
  }

  private toResolution({ subdomain, ...row }: HostStoreRow): StoreResolution {
    // The subdomain stays the primary host until P8.S9 lets a merchant promote a custom domain.
    return { ...row, primaryHost: hostOfSubdomain(subdomain, this.dependencies.platformDomain), status: 'active' };
  }
}
