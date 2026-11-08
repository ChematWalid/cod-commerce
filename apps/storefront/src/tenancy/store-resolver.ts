import type { NormalizedHost } from './host';
import type { StoreLocale } from './store-locale';

/** Whether a store serves buyers; a disabled store answers 404. */
export type StoreStatus = 'active' | 'disabled';

/** The store a request belongs to, as the storefront needs it. */
export interface ResolvedStore {
  readonly storeId: string;
  readonly businessId: string;
  readonly name: string;
  readonly logo: string | null;
  readonly defaultLocale: StoreLocale;
  readonly primaryHost: NormalizedHost;
  readonly status: StoreStatus;
}

/** Finds stores by host or id. */
export interface StoreResolver {
  resolveByHost(host: NormalizedHost): Promise<ResolvedStore | null>;
  findById(storeId: string): Promise<ResolvedStore | null>;
}

/**
 * The store id `generateStaticParams` returns. Next needs one entry to prerender at build time, when no store
 * exists to fetch; no real store has this id, and the proxy never routes a request to it.
 */
export const PRERENDER_SENTINEL_STORE_ID = 'prerender-sentinel';
