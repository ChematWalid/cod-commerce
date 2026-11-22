import type { SoldOutBehavior } from '@cod/shared';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/** The store a storefront context runs for, and how it treats sold-out products. */
export interface StorefrontStore {
  readonly scope: StoreScope;
  readonly soldOutBehavior: SoldOutBehavior;
}

/**
 * Storefront contexts (D3201): the store of a context the storefront guard or this port built, and contexts for work
 * outside a request (the outbox consumer, the backfill), for an active store of an active business only.
 */
export interface StorefrontStorePort {
  /** The store `ctx` runs for. Fails (404 at the API) for a context no storefront path built. */
  storeOf(ctx: OperationContext): StorefrontStore;

  /** A storefront context of `storeId`, or `undefined` for an unknown or inactive store. */
  contextFor(storeId: string): Promise<OperationContext | undefined>;
}
