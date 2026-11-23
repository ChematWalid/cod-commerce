import { storefrontStoreSchema } from '@cod/shared';
import { internalFetch } from '../lib/internal-api';
import { normalizeHost, type NormalizedHost } from './host';
import type { ResolvedStore, StoreResolver } from './store-resolver';

const NOT_FOUND = 404;

/** The API could not say whether the store exists: not a 404, so an outage is never shown as an unknown store. */
export class StoreResolverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreResolverError';
  }
}

/** Reads a store body with the shared store contract, the one `loadStore` reads too (D3203). */
function toResolvedStore(body: unknown): ResolvedStore {
  const parsed = storefrontStoreSchema.safeParse(body);
  if (!parsed.success) throw new StoreResolverError('the API answered with an unexpected store shape');
  const store = parsed.data;
  const primaryHost: NormalizedHost | null = normalizeHost(store.primaryHost);
  if (primaryHost === null) throw new StoreResolverError(`store ${store.storeId} has no primary host`);
  return {
    storeId: store.storeId,
    businessId: store.businessId,
    name: store.name,
    logo: store.logoPath,
    defaultLocale: store.language,
    primaryHost,
    status: store.status,
  };
}

/** Finds stores through the API, which owns the caches and their invalidation (D12). */
export class ApiStoreResolver implements StoreResolver {
  /** @throws StoreResolverError or a network error when the API cannot answer; StorefrontEnvError without a usable `INTERNAL_API_URL` */
  resolveByHost(host: NormalizedHost): Promise<ResolvedStore | null> {
    return this.fetchStore(`/store/resolve?host=${encodeURIComponent(host)}`);
  }

  /** @throws StoreResolverError or a network error when the API cannot answer */
  findById(storeId: string): Promise<ResolvedStore | null> {
    return this.fetchStore(`/store/by-id/${encodeURIComponent(storeId)}`);
  }

  private async fetchStore(path: string): Promise<ResolvedStore | null> {
    const response = await internalFetch(path);
    if (response.status === NOT_FOUND) return null;
    if (!response.ok) throw new StoreResolverError(`GET ${path} answered ${String(response.status)}`);
    return toResolvedStore(await response.json());
  }
}
