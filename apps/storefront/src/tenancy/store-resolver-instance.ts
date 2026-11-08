import { ApiStoreResolver } from './api-store-resolver';
import type { StoreResolver } from './store-resolver';

/** The resolver the proxy and the pages use. */
export const storeResolver: StoreResolver = new ApiStoreResolver();
