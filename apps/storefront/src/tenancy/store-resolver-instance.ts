import { platformDomain } from '../config/storefront-env';
import { ApiStoreResolver } from './api-store-resolver';
import { CachingStoreResolver } from './caching-store-resolver';
import { StoreLru } from './store-lru';
import type { StoreResolver } from './store-resolver';

/** The resolver the proxy and the pages use: the api behind the in-process host cache (#180). */
export const storeResolver: StoreResolver = new CachingStoreResolver(new ApiStoreResolver(), {
  lru: new StoreLru(),
  platformDomain,
});
