import type { NormalizedHost } from './host';
import type { StoreLocale } from './store-locale';

/** Whether a store serves buyers; a disabled store answers 404. */
export type StoreStatus = 'active' | 'disabled';

/** The store a request belongs to, as the storefront needs it. */
export interface ResolvedStore {
  readonly storeId: string;
  readonly businessId: string;
  readonly name: string;
  readonly defaultLocale: StoreLocale;
  readonly primaryHost: NormalizedHost;
  readonly status: StoreStatus;
}

/** Finds stores by host or id. P0 uses the stub; P1.S1 provides the real resolver. */
export interface StoreResolver {
  resolveByHost(host: NormalizedHost): Promise<ResolvedStore | null>;
  findById(storeId: string): Promise<ResolvedStore | null>;
}
