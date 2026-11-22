import type { RequestContext } from '@vendure/core';
import type { StorefrontStoreContext } from '../domain/storefront-store';
import { StorefrontStoreRefusedError } from './storefront-store-refused.filter';

/** An own symbol: `ctx.copy()` keeps it, so a transactional copy still knows its store (pattern of `tenant-of.ts`). */
const STOREFRONT_STORE = Symbol('storefrontStore');

type StorefrontAnchoredContext = RequestContext & { [STOREFRONT_STORE]?: StorefrontStoreContext };

/** Records the store the storefront guard built `ctx` for. Internal to tenancy. */
export function rememberStorefrontStore(ctx: RequestContext, store: StorefrontStoreContext): void {
  const anchored: StorefrontAnchoredContext = ctx;
  anchored[STOREFRONT_STORE] = store;
}

/**
 * The store of a context `@StorefrontCtx()` handed out: its id, business, channel, sold-out behaviour and language.
 *
 * @throws {@link StorefrontStoreRefusedError} for any other context, so a misuse answers 404, never another store
 */
export function storefrontStoreOf(ctx: RequestContext): StorefrontStoreContext {
  const store = (ctx as StorefrontAnchoredContext)[STOREFRONT_STORE];
  if (store === undefined) throw new StorefrontStoreRefusedError();
  return store;
}
