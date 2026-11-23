import type { StorefrontStoreContext } from '../../domain/storefront-store';

/** A context on a store's own channel, and the store it runs for. */
export interface StorefrontContext<TContext> {
  readonly ctx: TContext;
  readonly store: StorefrontStoreContext;
}

/**
 * Builds the context of a storefront call (D3201) from the store id the internal signature covered (D111), never from
 * client input. Fails closed: `undefined` for a malformed or unknown id, an archived store or a suspended business.
 */
export interface StorefrontContextsPort<TContext> {
  forStore(rawStoreId: string): Promise<StorefrontContext<TContext> | undefined>;
}
