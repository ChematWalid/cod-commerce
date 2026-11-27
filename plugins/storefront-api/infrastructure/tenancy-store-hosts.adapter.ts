import { PlatformStoreLookup } from '@cod/plugin-tenancy';
import { hostOfSubdomain, isSnowflake, toSnowflake, toStoreId } from '@cod/shared';
import type { StoreHostsPort } from '../domain/ports/store-hosts.port';

/**
 * {@link StoreHostsPort} over tenancy's store lookup: the platform subdomain host of a served store and its custom
 * domains (stubbed until P8.S9). An archived store or one of a suspended business has none.
 */
export class TenancyStoreHosts implements StoreHostsPort {
  constructor(
    private readonly stores: PlatformStoreLookup,
    private readonly platformDomain: string,
  ) {}

  async hostsOf(storeId: string): Promise<readonly string[]> {
    if (!isSnowflake(storeId)) return [];
    const row = await this.stores.findById(toSnowflake(storeId));
    if (row === null) return [];
    const custom = await this.stores.findCustomDomains(toStoreId(storeId));
    return [hostOfSubdomain(row.subdomain, this.platformDomain), ...custom];
  }
}
