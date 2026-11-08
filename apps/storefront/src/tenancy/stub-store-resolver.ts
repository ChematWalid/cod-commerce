import type { NormalizedHost } from './host';
import { toStoreLocale } from './store-locale';
import type { ResolvedStore, StoreResolver } from './store-resolver';

/** Two demo stores of two businesses, until P1.S1 resolves real ones. */
export const STUB_STORES: readonly ResolvedStore[] = [
  {
    storeId: 'demo',
    businessId: 'stub-business-a',
    name: 'Demo Store',
    defaultLocale: toStoreLocale('ar'),
    primaryHost: 'demo.localhost' as NormalizedHost,
    status: 'active',
  },
  {
    storeId: 'second',
    businessId: 'stub-business-b',
    name: 'Second Store',
    defaultLocale: toStoreLocale('fr'),
    primaryHost: 'second.localhost' as NormalizedHost,
    status: 'active',
  },
];

/** A {@link StoreResolver} over a fixed list of stores, each matched by its primary host only. */
export class StubStoreResolver implements StoreResolver {
  private readonly stores: readonly ResolvedStore[];

  /** @throws InvalidStoreLocaleError when a store's locale is not a platform language */
  constructor(stores: readonly ResolvedStore[]) {
    stores.forEach((store) => toStoreLocale(store.defaultLocale));
    this.stores = stores;
  }

  resolveByHost(host: NormalizedHost): Promise<ResolvedStore | null> {
    return Promise.resolve(this.stores.find((store) => store.primaryHost === host) ?? null);
  }

  findById(storeId: string): Promise<ResolvedStore | null> {
    return Promise.resolve(this.stores.find((store) => store.storeId === storeId) ?? null);
  }
}
