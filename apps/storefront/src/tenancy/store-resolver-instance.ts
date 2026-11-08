import type { StoreResolver } from './store-resolver';
import { STUB_STORES, StubStoreResolver } from './stub-store-resolver';

/** The resolver the proxy and the pages use. P1.S1 swaps this one line for the real resolver. */
export const storeResolver: StoreResolver = new StubStoreResolver(STUB_STORES);
