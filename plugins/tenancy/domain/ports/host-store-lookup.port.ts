import type { Snowflake, SoldOutBehavior, StoreId } from '@cod/shared';

/** The columns a host resolution and a storefront store context are built from. */
export interface HostStoreRow {
  readonly storeId: string;
  readonly businessId: string;
  /** Internal: the storefront context runs on it; it never leaves in a resolution. */
  readonly channelId: number;
  readonly language: string;
  readonly name: string;
  readonly description: string;
  readonly logo: string | null;
  readonly subdomain: string;
  readonly showAddressField: boolean;
  readonly soldOutBehavior: SoldOutBehavior;
}

/** Finds the stores that serve buyers. A store that is archived, or of a suspended business, is not found. */
export interface HostStoreLookupPort {
  findBySubdomain(subdomain: string): Promise<HostStoreRow | null>;
  findByCustomDomain(host: string): Promise<HostStoreRow | null>;
  findById(id: Snowflake): Promise<HostStoreRow | null>;
  /** Every custom host of the store, verified or not. */
  findCustomDomains(storeId: StoreId): Promise<readonly string[]>;
}
