import type { StoreResolution } from '../store-resolution';

/** A cache of host resolutions. Hosts are normalised before they get here. */
export interface HostCachePort {
  get(host: string): Promise<StoreResolution | null>;
  set(host: string, value: StoreResolution): Promise<void>;
  delete(hosts: readonly string[]): Promise<void>;
}
