/** The hostnames buyers reach a store on: its platform subdomain and its custom domains. */
export interface StoreHostsPort {
  /** Every hostname of `storeId`; none for an unknown, archived or suspended store. */
  hostsOf(storeId: string): Promise<readonly string[]>;
}
