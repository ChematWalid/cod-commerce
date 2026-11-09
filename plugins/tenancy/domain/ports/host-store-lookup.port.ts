import type { Snowflake, StoreId } from '@cod/shared';

/** The columns a host resolution is built from. */
export interface HostStoreRow {
  readonly storeId: string;
  readonly businessId: string;
  readonly language: string;
  readonly name: string;
  readonly logo: string | null;
  readonly subdomain: string;
}

/** Finds the stores that serve buyers. A store that is archived, or of a suspended business, is not found. */
export interface HostStoreLookupPort {
  findBySubdomain(subdomain: string): Promise<HostStoreRow | null>;
  findByCustomDomain(host: string): Promise<HostStoreRow | null>;
  findById(id: Snowflake): Promise<HostStoreRow | null>;
  /** Every custom host of the store, verified or not. */
  findCustomDomains(storeId: StoreId): Promise<readonly string[]>;
}
