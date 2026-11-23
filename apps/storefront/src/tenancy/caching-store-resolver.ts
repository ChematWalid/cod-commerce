import { subdomainOfHost } from '@cod/shared';
import type { NormalizedHost } from './host';
import type { StoreLru } from './store-lru';
import type { ResolvedStore, StoreResolver } from './store-resolver';

/** What a {@link CachingStoreResolver} needs. */
export interface CachingStoreResolverOptions {
  readonly lru: StoreLru;
  /** Read per call: the module is also evaluated during `next build`, where the environment is not validated. */
  readonly platformDomain: () => string;
}

/**
 * Puts the in-process {@link StoreLru} in front of the api resolver (#180). A host that is not
 * `<label>.<platformDomain>` has no store while custom domains are stubbed (P8.S9), so it is answered without
 * an api call; concurrent lookups of one host share one call; an api failure is never cached, so an outage
 * never turns into an unknown store.
 */
export class CachingStoreResolver implements StoreResolver {
  private readonly inFlight = new Map<NormalizedHost, Promise<ResolvedStore | null>>();
  private readonly inner: StoreResolver;
  private readonly options: CachingStoreResolverOptions;

  constructor(inner: StoreResolver, options: CachingStoreResolverOptions) {
    this.inner = inner;
    this.options = options;
  }

  /** @throws whatever the api resolver throws when the api cannot answer (never cached) */
  resolveByHost(host: NormalizedHost): Promise<ResolvedStore | null> {
    if (subdomainOfHost(host, this.options.platformDomain()) === null) return Promise.resolve(null);
    const cached = this.options.lru.get(host);
    if (cached !== undefined) return Promise.resolve(cached.store);
    const pending = this.inFlight.get(host) ?? this.lookUp(host);
    this.inFlight.set(host, pending);
    return pending;
  }

  /** Not cached: pages look stores up by id only behind the host check, and the api caches by id itself. */
  findById(storeId: string): Promise<ResolvedStore | null> {
    return this.inner.findById(storeId);
  }

  private async lookUp(host: NormalizedHost): Promise<ResolvedStore | null> {
    try {
      const store = await this.inner.resolveByHost(host);
      this.options.lru.set(host, store);
      return store;
    } finally {
      this.inFlight.delete(host);
    }
  }
}
